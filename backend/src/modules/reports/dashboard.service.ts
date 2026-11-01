import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../common/auth/auth-user.js';
import {
  addDays,
  businessDayStart,
  todayInBusinessZone,
} from '../../common/utils/dates.js';
import { Decimal } from '../../common/utils/money.js';
import {
  FelStatus,
  InvoiceStatus,
  NotificationStatus,
  OrderStatus,
  RefundStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StockService } from '../inventory/stock.service.js';
import {
  PERMISSIONS,
  type PermissionCode,
} from '../roles/permissions.catalog.js';
import type {
  DashboardDto,
  DashboardFinanceDto,
  DashboardNotificationsDto,
  DashboardOrdersDto,
  DashboardSalesDto,
  SalesAmountDto,
} from './dto/reports.dto.js';
import { daysBetween } from './report-range.js';
import { LOCAL_DAY, ReportsService, SALE_FILTER } from './reports.service.js';

const DAILY_DAYS = 30;

/**
 * Indicadores del panel. Cada sección se calcula solo si el usuario tiene el
 * permiso que la habilita; así el dashboard nunca expone datos que el
 * usuario no podría consultar en su pantalla correspondiente.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly reports: ReportsService,
  ) {}

  async get(user: AuthUser, now = new Date()): Promise<DashboardDto> {
    const can = (permission: PermissionCode) =>
      user.isSuperAdmin || user.permissions.has(permission);
    const today = todayInBusinessZone(now);
    const [orders, sales, finance, inventory, notifications] =
      await Promise.all([
        can(PERMISSIONS.ORDERS_READ) ? this.orders(today) : null,
        can(PERMISSIONS.REPORTS_READ) ? this.sales(today) : null,
        can(PERMISSIONS.BILLING_READ) ? this.finance() : null,
        can(PERMISSIONS.INVENTORY_READ) ? this.stock.alerts() : null,
        can(PERMISSIONS.NOTIFICATIONS_MANAGE) ? this.notifications() : null,
      ]);
    return { today, orders, sales, finance, inventory, notifications };
  }

  private async orders(today: string): Promise<DashboardOrdersDto> {
    const [counts, placedToday] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['status'],
        where: {
          status: {
            in: [
              OrderStatus.PENDING_CONFIRMATION,
              OrderStatus.PAYMENT_IN_REVIEW,
              OrderStatus.CONFIRMED,
              OrderStatus.PREPARING,
              OrderStatus.DELIVERY_FAILED,
            ],
          },
        },
        _count: { _all: true },
      }),
      this.prisma.order.count({
        where: { placedAt: { gte: businessDayStart(today) } },
      }),
    ]);
    const count = (status: OrderStatus) =>
      counts.find((c) => c.status === status)?._count._all ?? 0;
    return {
      placedToday,
      pendingConfirmation: count(OrderStatus.PENDING_CONFIRMATION),
      paymentInReview: count(OrderStatus.PAYMENT_IN_REVIEW),
      toPrepare: count(OrderStatus.CONFIRMED),
      toShip: count(OrderStatus.PREPARING),
      deliveryFailed: count(OrderStatus.DELIVERY_FAILED),
    };
  }

  private async sales(today: string): Promise<DashboardSalesDto> {
    const firstDay = addDays(today, -(DAILY_DAYS - 1));
    const monthStart = `${today.slice(0, 8)}01`;
    const since = monthStart < firstDay ? monthStart : firstDay;
    const end = businessDayStart(addDays(today, 1));
    const [rows, topProducts] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{ date: string; orders: number; total: string }>
      >`
        SELECT ${LOCAL_DAY} AS date,
          count(*)::int AS orders, sum(o.total)::text AS total
        FROM orders o
        WHERE ${SALE_FILTER} AND o.placed_at >= ${businessDayStart(since)} AND o.placed_at < ${end}
        GROUP BY 1`,
      this.reports.topProductRows(businessDayStart(firstDay), end, 5),
    ]);
    const byDay = new Map(rows.map((r) => [r.date, r]));
    const sum = (from: string): SalesAmountDto => {
      let orders = 0;
      let total = new Decimal(0);
      for (const row of rows) {
        if (row.date < from) continue;
        orders += row.orders;
        total = total.add(row.total);
      }
      return { orders, total: total.toFixed(2) };
    };
    return {
      today: sum(today),
      last7Days: sum(addDays(today, -6)),
      monthToDate: sum(monthStart),
      daily: daysBetween(firstDay, today).map((date) => ({
        date,
        orders: byDay.get(date)?.orders ?? 0,
        total: new Decimal(byDay.get(date)?.total ?? 0).toFixed(2),
      })),
      topProducts,
    };
  }

  private async finance(): Promise<DashboardFinanceDto> {
    const [refunds, felPending] = await Promise.all([
      this.prisma.refund.aggregate({
        where: { status: RefundStatus.PENDING },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.invoice.count({
        where: { status: InvoiceStatus.ISSUED, felStatus: FelStatus.PENDING },
      }),
    ]);
    return {
      pendingRefunds: refunds._count._all,
      pendingRefundsTotal: (refunds._sum.amount ?? new Decimal(0)).toFixed(2),
      felPending,
    };
  }

  private async notifications(): Promise<DashboardNotificationsDto> {
    const counts = await this.prisma.notificationLog.groupBy({
      by: ['status'],
      where: {
        status: { in: [NotificationStatus.PENDING, NotificationStatus.FAILED] },
      },
      _count: { _all: true },
    });
    const count = (status: NotificationStatus) =>
      counts.find((c) => c.status === status)?._count._all ?? 0;
    return {
      pending: count(NotificationStatus.PENDING),
      failed: count(NotificationStatus.FAILED),
    };
  }
}
