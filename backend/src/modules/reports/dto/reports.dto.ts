import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaymentMethod } from '../../../generated/prisma/enums.js';
import { InventoryAlertsDto } from '../../inventory/dto/inventory.dto.js';

export class ReportRangeQueryDto {
  /** AAAA-MM-DD, en la zona del negocio. */
  @IsDateString({ strict: true }) from: string;
  @IsDateString({ strict: true }) to: string;
}

export class TopProductsQueryDto extends ReportRangeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 20;
}

export class SalesTotalsDto {
  orders: number;
  units: number;
  /** Precios normales con IVA. */
  subtotal: string;
  discount: string;
  shipping: string;
  /** IVA contenido en las ventas y el envío. */
  tax: string;
  total: string;
  averageTicket: string;
}

export class SalesDayDto extends SalesTotalsDto {
  date: string;
}

export class PaymentMethodSalesDto {
  @ApiProperty({ enum: PaymentMethod, enumName: 'PaymentMethod' })
  method: PaymentMethod;
  orders: number;
  total: string;
}

export class SalesReportDto {
  from: string;
  to: string;
  days: SalesDayDto[];
  totals: SalesTotalsDto;
  byPaymentMethod: PaymentMethodSalesDto[];
}

export class TopProductDto {
  productId: string;
  sku: string;
  name: string;
  units: number;
  /** Total cobrado por el producto (con IVA y descuentos aplicados). */
  revenue: string;
  discount: string;
}

export class TopProductsReportDto {
  from: string;
  to: string;
  rows: TopProductDto[];
}

export class CategorySalesDto {
  categoryId: string;
  name: string;
  units: number;
  revenue: string;
  /** Porcentaje del total vendido en el período. */
  share: string;
}

export class CategorySalesReportDto {
  from: string;
  to: string;
  rows: CategorySalesDto[];
  total: string;
}

export class InventoryValuationRowDto {
  productId: string;
  sku: string;
  name: string;
  units: number;
  /** Unidades vencidas, en cuarentena, retiradas o bloqueadas. */
  unsellableUnits: number;
  /** Existencia × costo promedio de cada lote. */
  value: string;
}

export class InventoryValuationDto {
  /** Fecha de corte (hoy en Guatemala). */
  date: string;
  rows: InventoryValuationRowDto[];
  totalUnits: number;
  totalValue: string;
  unsellableValue: string;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export class DashboardOrdersDto {
  placedToday: number;
  pendingConfirmation: number;
  paymentInReview: number;
  toPrepare: number;
  toShip: number;
  deliveryFailed: number;
}

export class SalesAmountDto {
  orders: number;
  total: string;
}

export class DailySalesDto {
  date: string;
  orders: number;
  total: string;
}

export class DashboardSalesDto {
  today: SalesAmountDto;
  last7Days: SalesAmountDto;
  monthToDate: SalesAmountDto;
  /** Últimos 30 días, incluido hoy. */
  daily: DailySalesDto[];
  topProducts: TopProductDto[];
}

export class DashboardFinanceDto {
  pendingRefunds: number;
  pendingRefundsTotal: string;
  felPending: number;
}

export class DashboardNotificationsDto {
  pending: number;
  failed: number;
}

/** Cada sección es nula si el usuario no tiene el permiso que la habilita. */
export class DashboardDto {
  today: string;
  orders: DashboardOrdersDto | null;
  sales: DashboardSalesDto | null;
  finance: DashboardFinanceDto | null;
  inventory: InventoryAlertsDto | null;
  notifications: DashboardNotificationsDto | null;
}
