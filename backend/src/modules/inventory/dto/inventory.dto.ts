import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { LotStatus, MovementType } from '../../../generated/prisma/enums.js';

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);

/** Costo unitario con hasta 4 decimales, como texto ("12.3456"). */
export const IsUnitCost = () =>
  Matches(/^\d{1,8}(\.\d{1,4})?$/, {
    message: 'El costo debe ser un número con hasta 4 decimales',
  });

export const LotNumber = () =>
  Matches(/^[A-Za-z0-9./_-]{1,50}$/, {
    message:
      'El número de lote solo admite letras, números y . / _ - (máx. 50)',
  });

export const ADJUSTMENT_REASONS = [
  'COUNT_CORRECTION',
  'ENTRY_ERROR',
  'FOUND',
  'LOSS',
  'OTHER',
] as const;

export const OUTFLOW_REASONS = [
  'EXPIRED',
  'DAMAGED',
  'RECALL',
  'RETURN_TO_SUPPLIER',
  'OTHER',
] as const;

// ─── Peticiones ──────────────────────────────────────────────────────────────

/** Existencia inicial o ingreso fuera de una orden de compra. */
export class CreateLotDto {
  @IsUUID()
  productId: string;

  @trim
  @LotNumber()
  lotNumber: string;

  /** AAAA-MM-DD. Obligatoria para medicamentos (productos con principio activo). */
  @IsOptional()
  @IsDateString({ strict: true })
  expirationDate?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  manufacturingDate?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity: number;

  @IsUnitCost()
  unitCost: string;

  @IsOptional()
  @IsIn([LotStatus.AVAILABLE, LotStatus.QUARANTINE])
  @ApiProperty({
    enum: [LotStatus.AVAILABLE, LotStatus.QUARANTINE],
    required: false,
  })
  status?: LotStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class AdjustmentDto {
  @IsIn(['IN', 'OUT'])
  @ApiProperty({ enum: ['IN', 'OUT'] })
  direction: 'IN' | 'OUT';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity: number;

  @IsIn(ADJUSTMENT_REASONS)
  @ApiProperty({ enum: ADJUSTMENT_REASONS })
  reasonCode: (typeof ADJUSTMENT_REASONS)[number];

  @trim
  @IsString()
  @Matches(/\S/, { message: 'Explique el motivo del ajuste' })
  @MaxLength(500)
  notes: string;

  /** Número del movimiento que se corrige, si aplica. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  correctsMovementNumber?: number;
}

/** Bajas: vencidos, dañados, retiro del mercado o devolución al proveedor. */
export class OutflowDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity: number;

  @IsIn(OUTFLOW_REASONS)
  @ApiProperty({ enum: OUTFLOW_REASONS })
  reasonCode: (typeof OUTFLOW_REASONS)[number];

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class LotStatusDto {
  @IsEnum(LotStatus)
  @ApiProperty({ enum: LotStatus, enumName: 'LotStatus' })
  status: LotStatus;

  /** Obligatorio salvo al liberar (AVAILABLE). */
  @IsOptional()
  @trim
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class ListLotsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsUUID() productId?: string;

  @IsOptional()
  @IsEnum(LotStatus)
  @ApiProperty({ enum: LotStatus, enumName: 'LotStatus', required: false })
  status?: LotStatus;

  /** expired: vencidos · near: próximos a vencer · all (por defecto). */
  @IsOptional()
  @IsIn(['expired', 'near', 'all'])
  @ApiProperty({ enum: ['expired', 'near', 'all'], required: false })
  expiry: 'expired' | 'near' | 'all' = 'all';

  /** Solo lotes con existencia (por defecto true). */
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value !== 'false' && value !== false,
  )
  @IsBoolean()
  withStock: boolean = true;
}

export class StockQueryDto extends PaginationQueryDto {
  /** low: existencias bajas · expired: con vencidos · near: próximos a vencer · quarantine. */
  @IsOptional()
  @IsIn(['low', 'expired', 'near', 'quarantine', 'all'])
  @ApiProperty({
    enum: ['low', 'expired', 'near', 'quarantine', 'all'],
    required: false,
  })
  alert: 'low' | 'expired' | 'near' | 'quarantine' | 'all' = 'all';
}

export class ListMovementsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsUUID() lotId?: string;

  @IsOptional()
  @IsEnum(MovementType)
  @ApiProperty({
    enum: MovementType,
    enumName: 'MovementType',
    required: false,
  })
  type?: MovementType;

  /** AAAA-MM-DD (inclusive). */
  @IsOptional() @IsDateString({ strict: true }) from?: string;
  @IsOptional() @IsDateString({ strict: true }) to?: string;
}

export class InventorySettingsDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  minShelfLifeDaysForSale: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(730)
  nearExpiryDays: number;
}

// ─── Respuestas ──────────────────────────────────────────────────────────────

export class LotProductRefDto {
  id: string;
  sku: string;
  name: string;
}

export class LotDto {
  id: string;
  product: LotProductRefDto;
  lotNumber: string;
  expirationDate: string | null;
  manufacturingDate: string | null;
  @ApiProperty({ enum: LotStatus, enumName: 'LotStatus' })
  status: LotStatus;
  statusReason: string | null;
  qtyOnHand: number;
  qtyReserved: number;
  /** Disponible para la venta (0 si está vencido, por vencer, en cuarentena o bloqueado). */
  qtyAvailable: number;
  isExpired: boolean;
  isNearExpiry: boolean;
  /** Vence antes de la vida útil mínima para vender. */
  belowShelfLife: boolean;
  avgUnitCost: string;
  firstReceivedAt: string;
}

export class LotPageDto {
  items: LotDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class ProductStockDto {
  productId: string;
  sku: string;
  name: string;
  isActive: boolean;
  lowStockThreshold: number;
  physical: number;
  reserved: number;
  available: number;
  expired: number;
  quarantine: number;
  nearExpiry: number;
  /** Próximo vencimiento con existencia (AAAA-MM-DD). */
  nextExpiration: string | null;
  isLowStock: boolean;
}

export class ProductStockPageDto {
  items: ProductStockDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class InventoryAlertsDto {
  lowStockProducts: number;
  expiredLots: number;
  nearExpiryLots: number;
  quarantineLots: number;
  recalledLots: number;
}

export class MovementDto {
  id: string;
  number: number;
  @ApiProperty({ enum: MovementType, enumName: 'MovementType' })
  type: MovementType;
  quantity: number;
  balanceAfter: number;
  unitCost: string;
  reasonCode: string | null;
  notes: string | null;
  referenceType: string | null;
  referenceId: string | null;
  lot: { id: string; lotNumber: string };
  product: LotProductRefDto;
  user: { id: string; name: string };
  createdAt: string;
}

export class MovementPageDto {
  items: MovementDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class InventorySettingsResponseDto extends InventorySettingsDto {
  updatedAt: string;
}
