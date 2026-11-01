import { Injectable } from '@nestjs/common';
import {
  BUSINESS_TIME_ZONE,
  todayInBusinessZone,
} from '../../common/utils/dates.js';
import { Decimal } from '../../common/utils/money.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { PaymentMethod } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  CategorySalesReportDto,
  InventoryValuationDto,
  SalesDayDto,
  SalesReportDto,
  SalesTotalsDto,
  TopProductDto,
  TopProductsReportDto,
} from './dto/reports.dto.js';
import { daysBetween, reportWindow, SALE_STATUSES } from './report-range.js';

/** Filtro SQL de pedidos que cuentan como venta (constante, sin datos del usuario). */
export const SALE_FILTER = Prisma.raw(
  `o.status IN (${SALE_STATUSES.map((s) => `'${s}'`).join(', ')})`,
);
/** Día local (Guatemala) en que se hizo el pedido `o`. */
export const LOCAL_DAY = Prisma.raw(
  `to_char(o.placed_at AT TIME ZONE '${BUSINESS_TIME_ZONE}', 'YYYY-MM-DD')`,
);

interface SalesRow {
  date: string;
  orders: number;
  units: number;
  subtotal: string;
  discount: string;
  shipping: string;
  tax: string;
  total: string;
}

/**
 * Reportes de solo lectura. Las ventas se cuentan por la fecha en que se
 * hizo el pedido (hora de Guatemala) y solo incluyen pedidos confirmados que
 * no se cancelaron (SALE_STATUSES). Son montos brutos: las devoluciones y
 * reembolsos se ven en el reporte de ingresos (Facturación).
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async sales(from: string, to: string): Promise<SalesReportDto> {
    const { start, end } = reportWindow(from, to);
    const [rows, methods] = await Promise.all([
      this.prisma.$queryRaw<SalesRow[]>`
        WITH o AS (
          SELECT o.*, ${LOCAL_DAY} AS day,
            (SELECT COALESCE(sum(i.quantity), 0) FROM order_items i WHERE i.order_id = o.id) AS units
          FROM orders o
          WHERE ${SALE_FILTER} AND o.placed_at >= ${start} AND o.placed_at < ${end})
        SELECT day AS date, count(*)::int AS orders, sum(units)::int AS units,
          sum(subtotal)::text AS subtotal, sum(discount_total)::text AS discount,
          sum(shipping_cost)::text AS shipping, sum(tax_total)::text AS tax,
          sum(total)::text AS total
        FROM o GROUP BY day ORDER BY day`,
      this.prisma.$queryRaw<
        Array<{ method: PaymentMethod; orders: number; total: string }>
      >`
        SELECT o.payment_method AS method, count(*)::int AS orders, sum(o.total)::text AS total
        FROM orders o
        WHERE ${SALE_FILTER} AND o.placed_at >= ${start} AND o.placed_at < ${end}
        GROUP BY o.payment_method ORDER BY o.payment_method`,
    ]);
    const byDay = new Map(rows.map((r) => [r.date, r]));
    const days = daysBetween(from, to).map((date): SalesDayDto =>
      Object.assign({ date }, totalsOf([byDay.get(date)])),
    );
    return {
      from,
      to,
      days,
      totals: totalsOf(rows),
      byPaymentMethod: methods,
    };
  }

  async topProducts(
    from: string,
    to: string,
    limit: number,
  ): Promise<TopProductsReportDto> {
    const { start, end } = reportWindow(from, to);
    return { from, to, rows: await this.topProductRows(start, end, limit) };
  }

  /** Productos más vendidos por unidades (a igualdad, por monto). */
  async topProductRows(
    start: Date,
    end: Date,
    limit: number,
  ): Promise<TopProductDto[]> {
    return this.prisma.$queryRaw<TopProductDto[]>`
      SELECT p.id AS "productId", p.sku, p.name,
        sum(i.quantity)::int AS units,
        sum(i.line_total)::text AS revenue,
        sum(i.line_discount)::text AS discount
      FROM order_items i
      JOIN orders o ON o.id = i.order_id
      JOIN products p ON p.id = i.product_id
      WHERE ${SALE_FILTER} AND o.placed_at >= ${start} AND o.placed_at < ${end}
      GROUP BY p.id, p.sku, p.name
      ORDER BY units DESC, sum(i.line_total) DESC, p.name
      LIMIT ${limit}`;
  }

  async categories(from: string, to: string): Promise<CategorySalesReportDto> {
    const { start, end } = reportWindow(from, to);
    const rows = await this.prisma.$queryRaw<
      Array<{
        categoryId: string;
        name: string;
        units: number;
        revenue: string;
      }>
    >`
      SELECT c.id AS "categoryId", c.name,
        sum(i.quantity)::int AS units, sum(i.line_total)::text AS revenue
      FROM order_items i
      JOIN orders o ON o.id = i.order_id
      JOIN products p ON p.id = i.product_id
      JOIN categories c ON c.id = p.category_id
      WHERE ${SALE_FILTER} AND o.placed_at >= ${start} AND o.placed_at < ${end}
      GROUP BY c.id, c.name
      ORDER BY sum(i.line_total) DESC, c.name`;
    const total = rows.reduce((sum, r) => sum.add(r.revenue), new Decimal(0));
    return {
      from,
      to,
      total: total.toFixed(2),
      rows: rows.map((r) => ({
        ...r,
        revenue: new Decimal(r.revenue).toFixed(2),
        share: total.isZero()
          ? '0.0'
          : new Decimal(r.revenue).div(total).mul(100).toFixed(1),
      })),
    };
  }

  /** Existencias valorizadas al costo promedio de cada lote, a hoy. */
  async inventoryValuation(): Promise<InventoryValuationDto> {
    const today = todayInBusinessZone();
    const rows = await this.prisma.$queryRaw<
      Array<{
        productId: string;
        sku: string;
        name: string;
        units: number;
        unsellableUnits: number;
        value: string;
        unsellableValue: string;
      }>
    >`
      SELECT p.id AS "productId", p.sku, p.name,
        sum(l.qty_on_hand)::int AS units,
        COALESCE(sum(l.qty_on_hand) FILTER (
          WHERE l.status <> 'AVAILABLE' OR l.expiration_date < ${today}::date), 0)::int
          AS "unsellableUnits",
        round(sum(l.qty_on_hand * l.avg_unit_cost), 2)::text AS value,
        round(COALESCE(sum(l.qty_on_hand * l.avg_unit_cost) FILTER (
          WHERE l.status <> 'AVAILABLE' OR l.expiration_date < ${today}::date), 0), 2)::text
          AS "unsellableValue"
      FROM lots l
      JOIN products p ON p.id = l.product_id
      WHERE l.qty_on_hand > 0
      GROUP BY p.id, p.sku, p.name
      ORDER BY sum(l.qty_on_hand * l.avg_unit_cost) DESC, p.name`;
    return {
      date: today,
      rows: rows.map((r) => ({
        productId: r.productId,
        sku: r.sku,
        name: r.name,
        units: r.units,
        unsellableUnits: r.unsellableUnits,
        value: r.value,
      })),
      totalUnits: rows.reduce((sum, r) => sum + r.units, 0),
      totalValue: rows
        .reduce((sum, r) => sum.add(r.value), new Decimal(0))
        .toFixed(2),
      unsellableValue: rows
        .reduce((sum, r) => sum.add(r.unsellableValue), new Decimal(0))
        .toFixed(2),
    };
  }
}

/** Suma filas de ventas; el ticket promedio es total / pedidos. */
export function totalsOf(
  rows: ReadonlyArray<SalesRow | undefined>,
): SalesTotalsDto {
  const zero = new Decimal(0);
  let orders = 0;
  let units = 0;
  const sums = {
    subtotal: zero,
    discount: zero,
    shipping: zero,
    tax: zero,
    total: zero,
  };
  for (const row of rows) {
    if (!row) continue;
    orders += row.orders;
    units += row.units;
    for (const key of Object.keys(sums) as Array<keyof typeof sums>) {
      sums[key] = sums[key].add(row[key]);
    }
  }
  return {
    orders,
    units,
    subtotal: sums.subtotal.toFixed(2),
    discount: sums.discount.toFixed(2),
    shipping: sums.shipping.toFixed(2),
    tax: sums.tax.toFixed(2),
    total: sums.total.toFixed(2),
    averageTicket: orders ? sums.total.div(orders).toFixed(2) : '0.00',
  };
}
