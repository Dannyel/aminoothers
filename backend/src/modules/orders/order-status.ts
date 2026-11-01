import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  OrderStatus,
  PaymentMethod,
  type PaymentStatus,
} from '../../generated/prisma/enums.js';
import { enqueueOrderStatusChange } from '../notifications/outbox.js';

type Tx = Prisma.TransactionClient;

/** Transiciones permitidas del pedido (reglas de negocio §6). */
export const ORDER_TRANSITIONS: Readonly<
  Record<OrderStatus, readonly OrderStatus[]>
> = {
  PENDING_PAYMENT: [
    OrderStatus.PAYMENT_IN_REVIEW,
    OrderStatus.EXPIRED,
    OrderStatus.CANCELLED,
  ],
  PAYMENT_IN_REVIEW: [
    OrderStatus.CONFIRMED,
    OrderStatus.PENDING_PAYMENT,
    OrderStatus.CANCELLED,
  ],
  PENDING_CONFIRMATION: [
    OrderStatus.CONFIRMED,
    OrderStatus.EXPIRED,
    OrderStatus.CANCELLED,
  ],
  CONFIRMED: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  PREPARING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED, OrderStatus.DELIVERY_FAILED],
  DELIVERY_FAILED: [OrderStatus.SHIPPED, OrderStatus.RETURNED_TO_STORE],
  DELIVERED: [],
  RETURNED_TO_STORE: [],
  CANCELLED: [],
  EXPIRED: [],
};

/** El cliente puede cancelar antes de que el pedido se confirme (D8). */
export const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.PAYMENT_IN_REVIEW,
  OrderStatus.PENDING_CONFIRMATION,
];

/** El personal también puede cancelar confirmados y en preparación. */
export const STAFF_CANCELLABLE: readonly OrderStatus[] = [
  ...CUSTOMER_CANCELLABLE,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
];

export const ORDER_STATUS_NAMES: Readonly<Record<OrderStatus, string>> = {
  PENDING_PAYMENT: 'pendiente de pago',
  PAYMENT_IN_REVIEW: 'pago en revisión',
  PENDING_CONFIRMATION: 'pendiente de confirmación',
  CONFIRMED: 'confirmado',
  PREPARING: 'en preparación',
  SHIPPED: 'enviado',
  DELIVERED: 'entregado',
  DELIVERY_FAILED: 'entrega fallida',
  RETURNED_TO_STORE: 'devuelto a la farmacia',
  CANCELLED: 'cancelado',
  EXPIRED: 'vencido',
};

export interface LockedOrder {
  id: string;
  customer_id: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  total: string;
  reservation_expires_at: Date | null;
}

/**
 * Bloquea el pedido durante la transacción: toda operación que cambia su
 * estado pasa por aquí, así dos acciones simultáneas no se pisan.
 */
export async function lockOrder(
  tx: Tx,
  id: string,
  customerId?: string,
): Promise<LockedOrder> {
  const [order] = await tx.$queryRaw<LockedOrder[]>`
    SELECT id, customer_id, status, payment_method, total::text AS total, reservation_expires_at
    FROM orders WHERE id = ${id}::uuid FOR UPDATE`;
  if (!order || (customerId && order.customer_id !== customerId)) {
    throw new NotFoundException('Pedido no encontrado');
  }
  return order;
}

export function assertStatus(
  order: { status: OrderStatus },
  allowed: readonly OrderStatus[],
  action: string,
): void {
  if (!allowed.includes(order.status)) {
    throw new ConflictException(
      `No se puede ${action}: el pedido está ${ORDER_STATUS_NAMES[order.status]}`,
    );
  }
}

/**
 * Cambia el estado del pedido validando la transición, registra el historial
 * y encola el aviso al cliente, todo en la misma transacción. `changedById`
 * nulo indica el sistema.
 */
export async function transitionOrder(
  tx: Tx,
  order: { id: string; status: OrderStatus },
  to: OrderStatus,
  changedById: string | null,
  note?: string,
  extra: Prisma.OrderUpdateInput = {},
): Promise<void> {
  if (!ORDER_TRANSITIONS[order.status].includes(to)) {
    throw new ConflictException(
      `El pedido no puede pasar de ${ORDER_STATUS_NAMES[order.status]} a ${ORDER_STATUS_NAMES[to]}`,
    );
  }
  const from = order.status;
  await tx.order.update({
    where: { id: order.id },
    data: { ...extra, status: to },
  });
  await tx.orderStatusHistory.create({
    data: {
      orderId: order.id,
      fromStatus: from,
      toStatus: to,
      changedById,
      note,
    },
  });
  order.status = to;
  // El aviso por correo se encola en la misma transacción (bandeja de salida).
  await enqueueOrderStatusChange(tx, order.id, from, to, note ?? null);
}

export async function transitionPayment(
  tx: Tx,
  payment: { id: string; status: PaymentStatus },
  to: PaymentStatus,
  changedById: string | null,
  note?: string,
  extra: Prisma.PaymentUpdateInput = {},
): Promise<void> {
  await tx.payment.update({
    where: { id: payment.id },
    data: { ...extra, status: to },
  });
  await tx.paymentStatusHistory.create({
    data: {
      paymentId: payment.id,
      fromStatus: payment.status,
      toStatus: to,
      changedById,
      note,
    },
  });
  payment.status = to;
}
