import type { Prisma } from '../../generated/prisma/client.js';
import {
  NotificationType,
  OrderStatus,
  PaymentStatus,
} from '../../generated/prisma/enums.js';
import { trackingUrl } from '../settings/couriers.service.js';
import type {
  NotificationPayloads,
  OrderPlacedPayload,
  OrderStatusPayload,
} from './notification-payloads.js';
import { CUSTOMER_NOTIFIED_STATUSES } from './notification-templates.js';

type Tx = Prisma.TransactionClient;

export interface EnqueueInput<K extends NotificationType> {
  type: K;
  recipient: string;
  payload: NotificationPayloads[K];
  related?: { type: string; id: string };
  dedupeKey?: string;
}

/**
 * Encola un correo en la bandeja de salida. Se llama dentro de la transacción
 * del evento: si la operación se revierte, el aviso no existe; si se confirma,
 * el despachador lo envía aunque el servidor de correo esté caído.
 */
export async function enqueueNotification<K extends NotificationType>(
  tx: Tx,
  input: EnqueueInput<K>,
): Promise<void> {
  await tx.notificationLog.create({
    data: {
      type: input.type,
      recipient: input.recipient,
      payload: input.payload as unknown as Prisma.InputJsonValue,
      relatedType: input.related?.type ?? null,
      relatedId: input.related?.id ?? null,
      dedupeKey: input.dedupeKey ?? null,
    },
  });
}

const orderSelect = {
  id: true,
  number: true,
  total: true,
  discountTotal: true,
  taxTotal: true,
  shippingCost: true,
  shippingMethodName: true,
  paymentMethod: true,
  customerName: true,
  reservationExpiresAt: true,
  customer: { select: { user: { select: { email: true, firstName: true } } } },
} satisfies Prisma.OrderSelect;

/** Confirmación del pedido recién creado (con sus líneas e instrucciones de pago). */
export async function enqueueOrderPlaced(tx: Tx, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      ...orderSelect,
      items: {
        select: { productName: true, quantity: true, lineTotal: true },
        orderBy: { productName: 'asc' },
      },
    },
  });
  const payload: OrderPlacedPayload = {
    orderId: order.id,
    number: order.number,
    customerName: order.customer.user.firstName,
    paymentMethod: order.paymentMethod,
    total: order.total.toFixed(2),
    items: order.items.map((i) => ({
      name: i.productName,
      quantity: i.quantity,
      lineTotal: i.lineTotal.toFixed(2),
    })),
    shippingMethodName: order.shippingMethodName,
    shippingCost: order.shippingCost.toFixed(2),
    taxTotal: order.taxTotal.toFixed(2),
    discountTotal: order.discountTotal.toFixed(2),
    reservationExpiresAt: order.reservationExpiresAt?.toISOString() ?? null,
  };
  await enqueueNotification(tx, {
    type: NotificationType.ORDER_PLACED,
    recipient: order.customer.user.email,
    payload,
    related: { type: 'order', id: order.id },
  });
}

/**
 * Avisos de un cambio de estado del pedido: al cliente en los estados que le
 * conciernen y al personal cuando hay un comprobante por verificar. Lo llama
 * `transitionOrder`, así ninguna transición se queda sin su aviso.
 */
export async function enqueueOrderStatusChange(
  tx: Tx,
  orderId: string,
  from: OrderStatus,
  to: OrderStatus,
  note: string | null,
): Promise<void> {
  if (to === OrderStatus.PAYMENT_IN_REVIEW) {
    await enqueueTransferToVerify(tx, orderId);
    return;
  }
  // Volver a «pendiente de pago» solo se avisa cuando se rechazó un comprobante.
  if (
    !CUSTOMER_NOTIFIED_STATUSES.has(to) ||
    (to === OrderStatus.PENDING_PAYMENT &&
      from !== OrderStatus.PAYMENT_IN_REVIEW)
  ) {
    return;
  }
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      ...orderSelect,
      shipment: {
        select: {
          trackingNumber: true,
          courier: { select: { name: true, trackingUrlTemplate: true } },
        },
      },
      payments: {
        where: { status: PaymentStatus.REJECTED },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { rejectionReason: true },
      },
    },
  });
  const visibleNote =
    to === OrderStatus.PENDING_PAYMENT
      ? (order.payments[0]?.rejectionReason ?? null)
      : to === OrderStatus.CANCELLED
        ? note
        : null;
  const payload: OrderStatusPayload = {
    orderId: order.id,
    number: order.number,
    customerName: order.customer.user.firstName,
    paymentMethod: order.paymentMethod,
    total: order.total.toFixed(2),
    from,
    to,
    note: visibleNote,
    reservationExpiresAt: order.reservationExpiresAt?.toISOString() ?? null,
    shipment: order.shipment
      ? {
          courier: order.shipment.courier.name,
          trackingNumber: order.shipment.trackingNumber,
          trackingUrl: trackingUrl(
            order.shipment.courier.trackingUrlTemplate,
            order.shipment.trackingNumber,
          ),
        }
      : null,
  };
  await enqueueNotification(tx, {
    type: NotificationType.ORDER_STATUS_CHANGED,
    recipient: order.customer.user.email,
    payload,
    related: { type: 'order', id: order.id },
  });
}

async function enqueueTransferToVerify(tx: Tx, orderId: string) {
  const settings = await tx.storeSettings.findUnique({
    where: { id: 1 },
    select: { staffAlertEmail: true },
  });
  if (!settings?.staffAlertEmail) return;
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      total: true,
      customerName: true,
      payments: {
        where: { status: PaymentStatus.IN_REVIEW },
        take: 1,
        select: { bankReference: true },
      },
    },
  });
  await enqueueNotification(tx, {
    type: NotificationType.STAFF_TRANSFER_TO_VERIFY,
    recipient: settings.staffAlertEmail,
    payload: {
      orderId: order.id,
      number: order.number,
      total: order.total.toFixed(2),
      customerName: order.customerName,
      bankReference: order.payments[0]?.bankReference ?? null,
    },
    related: { type: 'order', id: order.id },
  });
}
