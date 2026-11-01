import type {
  OrderStatus,
  PaymentMethod,
} from '../../generated/prisma/enums.js';

/** Datos del pedido comunes a los avisos al cliente (copiados al encolar). */
export interface OrderRef {
  orderId: string;
  number: number;
  customerName: string;
  paymentMethod: PaymentMethod;
  total: string;
}

export interface OrderPlacedPayload extends OrderRef {
  items: Array<{ name: string; quantity: number; lineTotal: string }>;
  shippingMethodName: string;
  shippingCost: string;
  taxTotal: string;
  discountTotal: string;
  reservationExpiresAt: string | null;
}

export interface OrderStatusPayload extends OrderRef {
  from: OrderStatus;
  to: OrderStatus;
  /** Motivo visible para el cliente (cancelación, comprobante rechazado). */
  note: string | null;
  reservationExpiresAt: string | null;
  shipment: {
    courier: string;
    trackingNumber: string | null;
    trackingUrl: string | null;
  } | null;
}

export interface TransferToVerifyPayload {
  orderId: string;
  number: number;
  total: string;
  customerName: string;
  bankReference: string | null;
}

export interface InventoryDigestPayload {
  date: string;
  lowStockProducts: number;
  expiredLots: number;
  nearExpiryLots: number;
  quarantineLots: number;
  recalledLots: number;
}

export interface NotificationPayloads {
  ORDER_PLACED: OrderPlacedPayload;
  ORDER_STATUS_CHANGED: OrderStatusPayload;
  STAFF_TRANSFER_TO_VERIFY: TransferToVerifyPayload;
  STAFF_INVENTORY_DIGEST: InventoryDigestPayload;
}
