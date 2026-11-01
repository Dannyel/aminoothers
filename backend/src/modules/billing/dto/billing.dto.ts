import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { IsRequiredText } from '../../../common/validation/validators.js';
import {
  FelStatus,
  InvoiceKind,
  InvoiceStatus,
} from '../../../generated/prisma/enums.js';

// ─── Impuestos ───────────────────────────────────────────────────────────────

/** Tasa como porcentaje con hasta 2 decimales: "12" o "12.50". */
const IsPercent = () =>
  Matches(/^\d{1,2}(\.\d{1,2})?$/, {
    message: 'La tasa debe ser un porcentaje entre 0 y 99.99',
  });

export class TaxRateInputDto {
  @Matches(/^[A-Z0-9_]{2,20}$/, {
    message: 'El código solo admite mayúsculas, números y _ (2 a 20)',
  })
  code: string;

  @IsRequiredText(100) name: string;

  /** Porcentaje: "12" = 12 %. */
  @IsPercent() ratePercent: string;

  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class UpdateTaxRateDto {
  @IsOptional() @IsRequiredText(100) name?: string;

  /** Cambiar la tasa afecta solo las ventas futuras. */
  @IsOptional() @IsPercent() ratePercent?: string;

  /** true la vuelve predeterminada (la anterior deja de serlo). */
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class TaxRateDto {
  id: string;
  code: string;
  name: string;
  /** Proporción como texto decimal: "0.1200" = 12 %. */
  rate: string;
  isDefault: boolean;
}

export class TaxRateAdminDto extends TaxRateDto {
  isActive: boolean;
  /** Productos vigentes que la usan. */
  productCount: number;
}

// ─── Comprobantes ────────────────────────────────────────────────────────────

export class InvoicesQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(InvoiceStatus) status?: InvoiceStatus;
  @IsOptional() @IsEnum(FelStatus) felStatus?: FelStatus;
  @IsOptional() @IsDateString({ strict: true }) from?: string;
  @IsOptional() @IsDateString({ strict: true }) to?: string;
}

export class VoidInvoiceDto {
  @IsRequiredText(500) reason: string;
}

/** Datos de la FEL emitida en el portal del certificador (D11). */
export class RegisterFelDto {
  /** Número de autorización (UUID) que entrega el certificador. */
  @IsUUID('all', { message: 'El número de autorización debe ser un UUID' })
  authorizationUuid: string;

  @Matches(/^[A-Za-z0-9-]{1,50}$/, { message: 'Serie inválida' })
  series: string;

  @Matches(/^[0-9]{1,50}$/, { message: 'El número de DTE solo admite dígitos' })
  number: string;

  @IsRequiredText(100) certifier: string;

  /** Fecha y hora de certificación (ISO 8601). */
  @IsDateString() certifiedAt: string;
}

export class IncomeQueryDto {
  /** AAAA-MM-DD, en la zona del negocio. */
  @IsDateString({ strict: true }) from: string;
  @IsDateString({ strict: true }) to: string;
}

export class InvoiceItemDto {
  description: string;
  quantity: number;
  unitPrice: string;
  discount: string;
  taxAmount: string;
  lineTotal: string;
  isGood: boolean;
}

export class InvoiceFelDto {
  @ApiProperty({ enum: FelStatus, enumName: 'FelStatus' })
  status: FelStatus;
  authorizationUuid: string | null;
  series: string | null;
  number: string | null;
  certifier: string | null;
  certifiedAt: string | null;
}

export class InvoiceDto {
  id: string;
  number: number;
  orderId: string;
  orderNumber: number;
  @ApiProperty({ enum: InvoiceKind, enumName: 'InvoiceKind' })
  kind: InvoiceKind;
  @ApiProperty({ enum: InvoiceStatus, enumName: 'InvoiceStatus' })
  status: InvoiceStatus;
  issuedAt: string;
  voidedAt: string | null;
  voidReason: string | null;
  customerTaxId: string;
  customerName: string;
  customerAddress: string | null;
  currency: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  items: InvoiceItemDto[];
  fel: InvoiceFelDto;
  /** Leyenda obligatoria mientras no exista integración FEL. */
  legend: string;
}

export class InvoicePageDto {
  items: InvoiceDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class IncomeByMethodDto {
  bankTransfer: string;
  cashOnDelivery: string;
}

export class IncomeReportDto {
  from: string;
  to: string;
  /** Pagos aprobados o cobrados en el periodo. */
  received: string;
  receivedByMethod: IncomeByMethodDto;
  receivedCount: number;
  /** Reembolsos completados en el periodo. */
  refunded: string;
  refundedCount: number;
  /** Ingresos = recibidos − reembolsados. */
  net: string;
  invoicesIssued: number;
  invoicedTotal: string;
  invoicedTax: string;
  invoicesVoided: number;
  voidedTotal: string;
  /** Comprobantes vigentes cuya FEL aún no se registra (todas las fechas). */
  felPending: number;
}
