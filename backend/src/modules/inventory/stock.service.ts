import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ProductSearchService } from '../catalog/products/product-search.service.js';
import type {
  InventoryAlertsDto,
  ProductStockDto,
  ProductStockPageDto,
  StockQueryDto,
} from './dto/inventory.dto.js';
import {
  InventorySettingsService,
  type ExpiryWindow,
} from './inventory-settings.service.js';

interface StockRow {
  product_id: string;
  sku: string;
  name: string;
  is_active: boolean;
  low_stock_threshold: number;
  physical: number;
  reserved: number;
  available: number;
  expired: number;
  quarantine: number;
  near_expiry: number;
  next_expiration: Date | null;
}

/**
 * Existencias por producto según los conceptos del modelo:
 * física, reservada, disponible, vencida y en cuarentena. Todo se calcula
 * desde los lotes; no hay tablas de saldos que puedan desincronizarse.
 */
@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: InventorySettingsService,
    private readonly search: ProductSearchService,
  ) {}

  async summary(query: StockQueryDto): Promise<ProductStockPageDto> {
    const window = await this.settings.window();
    const ids = query.search
      ? await this.search.matchingIds(query.search)
      : null;
    if (ids && ids.length === 0) {
      return {
        items: [],
        total: 0,
        page: query.page,
        pageSize: query.pageSize,
      };
    }
    const base = this.stockQuery(window, ids);
    const having = HAVING[query.alert];
    const offset = (query.page - 1) * query.pageSize;

    const [rows, [{ total }]] = await Promise.all([
      this.prisma.$queryRaw<StockRow[]>`
        SELECT * FROM (${base}) s ${having}
        ORDER BY s.name, s.sku LIMIT ${query.pageSize} OFFSET ${offset}`,
      this.prisma.$queryRaw<Array<{ total: number }>>`
        SELECT count(*)::int AS total FROM (${base}) s ${having}`,
    ]);
    return {
      items: rows.map(toDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async alerts(): Promise<InventoryAlertsDto> {
    const window = await this.settings.window();
    const [[counts], [{ low }]] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          expired: number;
          near: number;
          quarantine: number;
          recalled: number;
        }>
      >`
        SELECT
          count(*) FILTER (WHERE expiration_date < ${window.today}::date)::int AS expired,
          count(*) FILTER (WHERE expiration_date >= ${window.today}::date
                             AND expiration_date <= ${window.nearExpiryUntil}::date)::int AS near,
          count(*) FILTER (WHERE status = 'QUARANTINE')::int AS quarantine,
          count(*) FILTER (WHERE status = 'RECALLED')::int AS recalled
        FROM lots WHERE qty_on_hand > 0`,
      this.prisma.$queryRaw<Array<{ low: number }>>`
        SELECT count(*)::int AS low FROM (${this.stockQuery(window, null)}) s ${HAVING.low}`,
    ]);
    return {
      lowStockProducts: low,
      expiredLots: counts.expired,
      nearExpiryLots: counts.near,
      quarantineLots: counts.quarantine,
      recalledLots: counts.recalled,
    };
  }

  /** Disponible para la venta por producto (lo usarán la tienda y el carrito). */
  async availableByProduct(productIds: string[]): Promise<Map<string, number>> {
    if (productIds.length === 0) return new Map();
    const window = await this.settings.window();
    const rows = await this.prisma.$queryRaw<
      Array<{ product_id: string; available: number }>
    >`
      SELECT product_id, COALESCE(sum(qty_on_hand - qty_reserved), 0)::int AS available
      FROM lots
      WHERE product_id IN (${Prisma.join(productIds.map((id) => Prisma.sql`${id}::uuid`))})
        AND ${sellable(window)}
      GROUP BY product_id`;
    return new Map(rows.map((r) => [r.product_id, r.available]));
  }

  private stockQuery(window: ExpiryWindow, ids: string[] | null): Prisma.Sql {
    const idFilter = ids
      ? Prisma.sql`AND p.id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})`
      : Prisma.empty;
    return Prisma.sql`
      SELECT p.id AS product_id, p.sku, p.name, p.is_active, p.low_stock_threshold,
        COALESCE(sum(l.qty_on_hand), 0)::int AS physical,
        COALESCE(sum(l.qty_reserved), 0)::int AS reserved,
        COALESCE(sum(l.qty_on_hand - l.qty_reserved) FILTER (WHERE ${sellable(window, 'l')}), 0)::int
          AS available,
        COALESCE(sum(l.qty_on_hand) FILTER (WHERE l.expiration_date < ${window.today}::date), 0)::int
          AS expired,
        COALESCE(sum(l.qty_on_hand) FILTER (WHERE l.status = 'QUARANTINE'), 0)::int AS quarantine,
        COALESCE(sum(l.qty_on_hand) FILTER (
          WHERE l.expiration_date >= ${window.today}::date
            AND l.expiration_date <= ${window.nearExpiryUntil}::date), 0)::int AS near_expiry,
        min(l.expiration_date) FILTER (WHERE l.qty_on_hand > 0) AS next_expiration
      FROM products p
      LEFT JOIN lots l ON l.product_id = p.id
      WHERE p.deleted_at IS NULL ${idFilter}
      GROUP BY p.id`;
  }
}

/** Lote vendible: disponible y con vida útil suficiente (D4). */
export function sellable(window: ExpiryWindow, alias?: string): Prisma.Sql {
  const col = (name: string) => Prisma.raw(alias ? `${alias}.${name}` : name);
  return Prisma.sql`${col('status')} = 'AVAILABLE'
    AND (${col('expiration_date')} IS NULL OR ${col('expiration_date')} >= ${window.sellableFrom}::date)`;
}

const HAVING: Record<StockQueryDto['alert'], Prisma.Sql> = {
  all: Prisma.empty,
  low: Prisma.sql`WHERE s.is_active AND s.available <= s.low_stock_threshold`,
  expired: Prisma.sql`WHERE s.expired > 0`,
  near: Prisma.sql`WHERE s.near_expiry > 0`,
  quarantine: Prisma.sql`WHERE s.quarantine > 0`,
};

function toDto(row: StockRow): ProductStockDto {
  return {
    productId: row.product_id,
    sku: row.sku,
    name: row.name,
    isActive: row.is_active,
    lowStockThreshold: row.low_stock_threshold,
    physical: row.physical,
    reserved: row.reserved,
    available: row.available,
    expired: row.expired,
    quarantine: row.quarantine,
    nearExpiry: row.near_expiry,
    nextExpiration: row.next_expiration
      ? row.next_expiration.toISOString().slice(0, 10)
      : null,
    isLowStock: row.is_active && row.available <= row.low_stock_threshold,
  };
}
