import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import {
  IsMoneyAmount,
  IsOptionalText,
  IsRequiredText,
} from '../../../common/validation/validators.js';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RefundMethod,
  RefundStatus,
  ReturnDisposition,
  ReturnStatus,
} from '../../../generated/prisma/enums.js';

// ─── Pedidos ─────────────────────────────────────────────────────────────────

export class AdminOrdersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  /** AAAA-MM-DD, en la zona del negocio. */
  @IsOptional() @IsDateString({ strict: true }) from?: string;
  @IsOptional() @IsDateString({ strict: true }) to?: string;
}

export class CustomerCancelOrderDto {
  @IsOptional() @IsOptionalText(500) reason?: string | null;
}

export class StaffCancelOrderDto {
  /** Obligatorio para el personal. */
  @IsRequiredText(500) reason: string;
}

export class OrderNoteDto {
  @IsOptional() @IsOptionalText(500) note?: string | null;
}

export class RequiredNoteDto {
  @IsRequiredText(500) note: string;
}

export class DispatchOrderDto {
  @IsUUID() courierId: string;

  @IsOptional()
  @IsOptionalText(100)
  @Matches(/^[A-Za-z0-9-]{3,100}$/, {
    message: 'El número de guía solo admite letras, números y guiones',
  })
  trackingNumber?: string | null;

  /** Costo que cobra la mensajería a la farmacia. */
  @IsOptional() @IsMoneyAmount() courierCost?: string;
  @IsOptional() @IsOptionalText(500) notes?: string | null;
}

export class RedispatchOrderDto {
  @IsOptional()
  @IsOptionalText(100)
  @Matches(/^[A-Za-z0-9-]{3,100}$/, {
    message: 'El número de guía solo admite letras, números y guiones',
  })
  trackingNumber?: string | null;

  @IsOptional() @IsOptionalText(500) note?: string | null;
}

export class DeliverOrderDto {
  @IsOptional() @IsOptionalText(150) receivedByName?: string | null;

  /** Contra entrega: monto cobrado (obligatorio). */
  @IsOptional() @IsMoneyAmount() collectedAmount?: string;

  /** Obligatoria si lo cobrado difiere del total. */
  @IsOptional() @IsOptionalText(500) note?: string | null;
}

export const MANUAL_EVENT_STATUSES = ['DISPATCHED', 'IN_TRANSIT'] as const;

export class ShipmentEventInputDto {
  @IsIn(MANUAL_EVENT_STATUSES)
  status: (typeof MANUAL_EVENT_STATUSES)[number];

  @IsRequiredText(300) description: string;
  @IsOptional() @IsOptionalText(150) location?: string | null;

  /** Fecha y hora del evento; por defecto, ahora. */
  @IsOptional() @IsDateString() occurredAt?: string;
}

// ─── Pagos ───────────────────────────────────────────────────────────────────

/** Datos de la transferencia que acompañan el comprobante (multipart). */
export class SubmitTransferDto {
  @IsUUID() bankAccountId: string;

  @Matches(/^[A-Za-z0-9-]{4,50}$/, {
    message: 'La referencia solo admite letras, números y guiones (4 a 50)',
  })
  bankReference: string;

  /** AAAA-MM-DD. */
  @IsDateString({ strict: true }) transferDate: string;
}

export class PaymentsQueryDto extends PaginationQueryDto {
  /** Por defecto, los pendientes de verificación. */
  @IsOptional()
  @IsEnum(PaymentStatus)
  status: PaymentStatus = PaymentStatus.IN_REVIEW;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;
}

export class RejectPaymentDto {
  @IsRequiredText(500) reason: string;
}

export class CreateRefundDto {
  @IsMoneyAmount() amount: string;

  @ApiProperty({ enum: RefundMethod, enumName: 'RefundMethod' })
  @IsEnum(RefundMethod)
  method: RefundMethod;

  @IsRequiredText(500) reason: string;

  /** Devolución que lo origina (opcional). */
  @IsOptional() @IsUUID() returnId?: string;
}

export class CompleteRefundDto {
  /** Referencia de la transferencia o del recibo de efectivo. */
  @IsRequiredText(100) reference: string;
}

export class RefundsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(RefundStatus)
  status?: RefundStatus;
}

// ─── Devoluciones ────────────────────────────────────────────────────────────

export class ReturnLineInputDto {
  @IsUUID() orderItemId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity: number;
}

export class CreateReturnDto {
  @IsRequiredText(500) reason: string;
  @IsOptional() @IsOptionalText(1000) notes?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ReturnLineInputDto)
  items: ReturnLineInputDto[];
}

export class RejectReturnDto {
  @IsRequiredText(500) reason: string;
}

export const INSPECTION_DISPOSITIONS = [
  ReturnDisposition.RESTOCK,
  ReturnDisposition.DESTROY,
  ReturnDisposition.RETURN_TO_SUPPLIER,
] as const;

export class InspectReturnItemDto {
  @ApiProperty({ enum: INSPECTION_DISPOSITIONS })
  @IsIn(INSPECTION_DISPOSITIONS)
  disposition: (typeof INSPECTION_DISPOSITIONS)[number];

  @IsOptional() @IsOptionalText(500) conditionNotes?: string | null;
}

export class ReturnsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ReturnStatus)
  status?: ReturnStatus;
}
