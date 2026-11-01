import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import {
  IsMoneyAmount,
  IsNit,
  IsOptionalText,
} from '../../../common/validation/validators.js';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RefundMethod,
  RefundStatus,
  ReturnDisposition,
  FelStatus,
  InvoiceStatus,
  ReturnStatus,
  ShipmentStatus,
} from '../../../generated/prisma/enums.js';

// ─── Peticiones ──────────────────────────────────────────────────────────────

/**
 * Confirmación del pedido. Los importes los calcula el backend; `expectedTotal`
 * es el total que vio el cliente y solo se usa para detectar cambios.
 */
export class PlaceOrderDto {
  @IsUUID()
  addressId: string;

  @IsUUID()
  shippingMethodId: string;

  @ApiProperty({ enum: PaymentMethod, enumName: 'PaymentMethod' })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  /** NIT para facturación; por defecto el del perfil o CF (D12). */
  @IsOptional()
  @IsNit()
  billingTaxId?: string;

  /** Nombre para facturación; por defecto el del perfil. */
  @IsOptional()
  @IsOptionalText(200)
  billingName?: string | null;

  @IsOptional()
  @IsOptionalText(500)
  notes?: string | null;

  @IsMoneyAmount()
  expectedTotal: string;
}

export class StoreOrdersQueryDto extends PaginationQueryDto {}

// ─── Respuestas ──────────────────────────────────────────────────────────────

export class OrderItemDto {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  presentationLabel: string | null;
  concentrationLabel: string | null;
  unitPrice: string;
  unitDiscount: string;
  quantity: number;
  lineTotal: string;
  lineTax: string;
  quantityReturned: number;
}

export class OrderShippingDto {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  zone: string | null;
  municipality: string;
  department: string;
  reference: string | null;
  methodName: string;
  cost: string;
}

export class OrderPaymentDto {
  @ApiProperty({ enum: PaymentMethod, enumName: 'PaymentMethod' })
  method: PaymentMethod;
  @ApiProperty({ enum: PaymentStatus, enumName: 'PaymentStatus' })
  status: PaymentStatus;
  amount: string;
  /** Transferencia: banco de destino, referencia y fecha que indicó el cliente. */
  bankName: string | null;
  bankReference: string | null;
  transferDate: string | null;
}

export class ShipmentEventDto {
  @ApiProperty({ enum: ShipmentStatus, enumName: 'ShipmentStatus' })
  status: ShipmentStatus;
  description: string;
  location: string | null;
  occurredAt: string;
}

/** Comprobante interno del pedido (no es factura) y datos FEL registrados. */
export class OrderReceiptDto {
  id: string;
  number: number;
  @ApiProperty({ enum: InvoiceStatus, enumName: 'InvoiceStatus' })
  status: InvoiceStatus;
  issuedAt: string;
  @ApiProperty({ enum: FelStatus, enumName: 'FelStatus' })
  felStatus: FelStatus;
  felSeries: string | null;
  felNumber: string | null;
}

/** Envío visible para el cliente. */
export class OrderShipmentDto {
  courierName: string;
  trackingNumber: string | null;
  /** Enlace de rastreo de la mensajería, si tiene plantilla. */
  trackingUrl: string | null;
  @ApiProperty({ enum: ShipmentStatus, enumName: 'ShipmentStatus' })
  status: ShipmentStatus;
  dispatchedAt: string;
  deliveredAt: string | null;
  receivedByName: string | null;
  events: ShipmentEventDto[];
}

export class OrderHistoryEntryDto {
  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus', nullable: true })
  fromStatus: OrderStatus | null;
  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  toStatus: OrderStatus;
  note: string | null;
  createdAt: string;
}

export class OrderSummaryDto {
  id: string;
  number: number;
  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  status: OrderStatus;
  @ApiProperty({ enum: PaymentMethod, enumName: 'PaymentMethod' })
  paymentMethod: PaymentMethod;
  placedAt: string;
  itemCount: number;
  total: string;
}

export class OrderSummaryPageDto {
  items: OrderSummaryDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class OrderDetailDto extends OrderSummaryDto {
  /** Si el pedido sigue pendiente a esta hora, la reserva se libera. */
  reservationExpiresAt: string | null;
  billingTaxId: string;
  billingName: string;
  shipping: OrderShippingDto;
  /** Pago vigente (o el último, si no hay vigente). */
  payment: OrderPaymentDto | null;
  items: OrderItemDto[];
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  shippingCost: string;
  customerNotes: string | null;
  history: OrderHistoryEntryDto[];
  cancelledAt: string | null;
  cancelReason: string | null;
  shipment: OrderShipmentDto | null;
  receipt: OrderReceiptDto | null;
  /** Motivo del último comprobante rechazado, si el pago está pendiente de nuevo. */
  paymentRejectionReason: string | null;
  /** El cliente puede cancelarlo (antes de confirmarse, D8). */
  canCancel: boolean;
  /** El cliente puede registrar su transferencia. */
  canSubmitTransfer: boolean;
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export class StaffRefDto {
  id: string;
  name: string;
}

export class PaymentHistoryEntryDto {
  @ApiProperty({
    enum: PaymentStatus,
    enumName: 'PaymentStatus',
    nullable: true,
  })
  fromStatus: PaymentStatus | null;
  @ApiProperty({ enum: PaymentStatus, enumName: 'PaymentStatus' })
  toStatus: PaymentStatus;
  note: string | null;
  createdAt: string;
}

export class RefundDto {
  id: string;
  paymentId: string;
  orderId: string;
  orderNumber: number;
  returnId: string | null;
  returnNumber: number | null;
  amount: string;
  @ApiProperty({ enum: RefundMethod, enumName: 'RefundMethod' })
  method: RefundMethod;
  reference: string | null;
  reason: string;
  @ApiProperty({ enum: RefundStatus, enumName: 'RefundStatus' })
  status: RefundStatus;
  createdAt: string;
  processedAt: string | null;
  processedBy: StaffRefDto | null;
}

export class RefundPageDto {
  items: RefundDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class AdminPaymentDto {
  id: string;
  @ApiProperty({ enum: PaymentMethod, enumName: 'PaymentMethod' })
  method: PaymentMethod;
  @ApiProperty({ enum: PaymentStatus, enumName: 'PaymentStatus' })
  status: PaymentStatus;
  amount: string;
  bankAccount: { id: string; bankName: string; accountNumber: string } | null;
  bankReference: string | null;
  transferDate: string | null;
  hasProof: boolean;
  proofMimeType: string | null;
  submittedAt: string | null;
  verifiedBy: StaffRefDto | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  collectedAmount: string | null;
  collectedBy: StaffRefDto | null;
  collectedAt: string | null;
  collectionNote: string | null;
  /** Reembolsos completados. */
  refundedAmount: string;
  /** Lo que aún se puede reembolsar (pagado − pendientes − completados). */
  refundableAmount: string;
  refunds: RefundDto[];
  history: PaymentHistoryEntryDto[];
  createdAt: string;
}

export class PaymentOrderRefDto {
  id: string;
  number: number;
  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  status: OrderStatus;
  customerName: string;
  customerEmail: string;
  total: string;
}

export class PaymentListItemDto extends AdminPaymentDto {
  order: PaymentOrderRefDto;
}

export class PaymentPageDto {
  items: PaymentListItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class AdminShipmentDto extends OrderShipmentDto {
  courierId: string;
  courierCost: string | null;
  notes: string | null;
}

export class ReturnItemDto {
  id: string;
  orderItemId: string;
  productName: string;
  sku: string;
  lotId: string;
  lotNumber: string;
  quantity: number;
  /** Importe de la línea devuelta (precio pagado × unidades). */
  amount: string;
  @ApiProperty({ enum: ReturnDisposition, enumName: 'ReturnDisposition' })
  disposition: ReturnDisposition;
  conditionNotes: string | null;
  inspectedAt: string | null;
  inspectedBy: StaffRefDto | null;
}

export class ReturnDto {
  id: string;
  number: number;
  orderId: string;
  orderNumber: number;
  customerName: string;
  @ApiProperty({ enum: ReturnStatus, enumName: 'ReturnStatus' })
  status: ReturnStatus;
  reason: string;
  notes: string | null;
  rejectedReason: string | null;
  createdBy: StaffRefDto | null;
  createdAt: string;
  decidedAt: string | null;
  receivedAt: string | null;
  closedAt: string | null;
  items: ReturnItemDto[];
  /** Suma de los importes de las líneas devueltas. */
  amount: string;
  refunds: RefundDto[];
}

export class ReturnPageDto {
  items: ReturnDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class ReservationDto {
  orderItemId: string;
  productName: string;
  lotId: string;
  lotNumber: string;
  /** AAAA-MM-DD. */
  expirationDate: string | null;
  quantity: number;
  status: string;
}

export const ORDER_ACTIONS = [
  'confirm',
  'prepare',
  'dispatch',
  'addEvent',
  'deliver',
  'fail',
  'redispatch',
  'returnToStore',
  'cancel',
  'createReturn',
] as const;
export type OrderAction = (typeof ORDER_ACTIONS)[number];

export class AdminOrderSummaryDto extends OrderSummaryDto {
  customerName: string;
  customerEmail: string;
}

export class AdminOrderSummaryPageDto {
  items: AdminOrderSummaryDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class AdminOrderDetailDto extends OrderDetailDto {
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  cancelledBy: StaffRefDto | null;
  payments: AdminPaymentDto[];
  adminShipment: AdminShipmentDto | null;
  reservations: ReservationDto[];
  returns: ReturnDto[];
  /** Hasta cuándo se pueden registrar devoluciones (D7), si ya se entregó. */
  returnDeadline: string | null;
  /** Acciones que el estado actual permite (el permiso se valida aparte). */
  @ApiProperty({ enum: ORDER_ACTIONS, isArray: true })
  actions: OrderAction[];
}
