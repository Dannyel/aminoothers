import { Injectable, NotFoundException } from '@nestjs/common';
import {
  addDays,
  businessDayStart,
  formatDateOnly,
  todayInBusinessZone,
} from '../../common/utils/dates.js';
import { Decimal } from '../../common/utils/money.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { trackingUrl } from '../settings/couriers.service.js';
import type {
  AdminOrderDetailDto,
  AdminOrderSummaryPageDto,
  AdminPaymentDto,
  OrderAction,
  OrderDetailDto,
  OrderShipmentDto,
  OrderSummaryDto,
  OrderSummaryPageDto,
  RefundDto,
  ReturnDto,
  StaffRefDto,
  StoreOrdersQueryDto,
} from './dto/orders.dto.js';
import type { AdminOrdersQueryDto } from './dto/sales.dto.js';
import { CUSTOMER_CANCELLABLE, STAFF_CANCELLABLE } from './order-status.js';

export const paymentInclude = {
  bankAccount: { select: { id: true, bankName: true, accountNumber: true } },
  proofFile: { select: { mimeType: true } },
  statusHistory: { orderBy: { createdAt: 'asc' } },
  refunds: {
    orderBy: { createdAt: 'asc' },
    include: {
      payment: {
        select: { orderId: true, order: { select: { number: true } } },
      },
      return: { select: { number: true } },
    },
  },
} satisfies Prisma.PaymentInclude;

export const returnInclude = {
  order: { select: { number: true, customerName: true } },
  items: {
    orderBy: { id: 'asc' },
    include: {
      lot: { select: { lotNumber: true } },
      orderItem: {
        select: {
          productName: true,
          sku: true,
          unitPrice: true,
          unitDiscount: true,
        },
      },
    },
  },
  refunds: {
    orderBy: { createdAt: 'asc' },
    include: {
      payment: {
        select: { orderId: true, order: { select: { number: true } } },
      },
      return: { select: { number: true } },
    },
  },
} satisfies Prisma.ReturnInclude;

export const orderDetailInclude = {
  items: { orderBy: { productName: 'asc' } },
  payments: { orderBy: { createdAt: 'desc' }, include: paymentInclude },
  statusHistory: { orderBy: { createdAt: 'asc' } },
  shipment: {
    include: {
      courier: { select: { name: true, trackingUrlTemplate: true } },
      events: { orderBy: { occurredAt: 'asc' } },
    },
  },
  invoice: {
    select: {
      id: true,
      number: true,
      status: true,
      issuedAt: true,
      felStatus: true,
      felSeries: true,
      felNumber: true,
    },
  },
} satisfies Prisma.OrderInclude;

type DetailRow = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;
type PaymentRow = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;
type RefundRow = PaymentRow['refunds'][number];
type ReturnRow = Prisma.ReturnGetPayload<{ include: typeof returnInclude }>;

/** Nombres del personal por id (para mostrar quién hizo cada acción). */
export type StaffNames = ReadonlyMap<string, string>;

const OPEN_PAYMENT: readonly PaymentStatus[] = [
  PaymentStatus.PENDING,
  PaymentStatus.IN_REVIEW,
  PaymentStatus.APPROVED,
  PaymentStatus.PARTIALLY_REFUNDED,
  PaymentStatus.REFUNDED,
];

/** Consulta de pedidos para el cliente y para el panel. */
@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async listForCustomer(
    customerId: string,
    query: StoreOrdersQueryDto,
  ): Promise<OrderSummaryPageDto> {
    const where = { customerId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { items: { select: { quantity: true } } },
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      items: rows.map((o) => toSummary(o, o.items)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getForCustomer(
    customerId: string,
    id: string,
  ): Promise<OrderDetailDto> {
    const order = await this.prisma.order.findFirst({
      where: { id, customerId },
      include: orderDetailInclude,
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return toDetail(order);
  }

  async listForStaff(
    query: AdminOrdersQueryDto,
  ): Promise<AdminOrderSummaryPageDto> {
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      ...(query.from || query.to
        ? {
            placedAt: {
              ...(query.from ? { gte: businessDayStart(query.from) } : {}),
              ...(query.to
                ? { lt: businessDayStart(addDays(query.to, 1)) }
                : {}),
            },
          }
        : {}),
    };
    const search = query.search?.trim();
    if (search) {
      const number = Number(search.replace(/^PED-?/i, ''));
      where.OR = [
        ...(Number.isInteger(number) && number > 0 ? [{ number }] : []),
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { items: { select: { quantity: true } } },
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      items: rows.map((o) => ({
        // toSummary devuelve un objeto plano; el tipo es una clase solo por Swagger.
        // oxlint-disable-next-line typescript/no-misused-spread
        ...toSummary(o, o.items),
        customerName: o.customerName,
        customerEmail: o.customerEmail,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getForStaff(id: string): Promise<AdminOrderDetailDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        ...orderDetailInclude,
        shipment: {
          include: {
            courier: { select: { name: true, trackingUrlTemplate: true } },
            events: { orderBy: { occurredAt: 'asc' } },
          },
        },
        returns: { orderBy: { createdAt: 'asc' }, include: returnInclude },
        items: {
          orderBy: { productName: 'asc' },
          include: {
            reservations: {
              orderBy: { createdAt: 'asc' },
              include: {
                lot: { select: { lotNumber: true, expirationDate: true } },
              },
            },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    const settings = await this.prisma.storeSettings.findUniqueOrThrow({
      where: { id: 1 },
    });
    const names = await this.staffNames([
      order.cancelledById,
      ...order.payments.flatMap((p) => [
        p.verifiedById,
        p.collectedById,
        ...p.refunds.map((r) => r.processedById),
      ]),
      ...order.returns.flatMap((r) => [
        r.createdById,
        ...r.items.map((i) => i.inspectedById),
        ...r.refunds.map((f) => f.processedById),
      ]),
    ]);
    const deadline = order.shipment?.deliveredAt
      ? addDays(
          todayInBusinessZone(order.shipment.deliveredAt),
          settings.returnWindowDays,
        )
      : null;
    const base = toDetail(order);
    return {
      // toDetail devuelve un objeto plano; el tipo es una clase solo por Swagger.
      // oxlint-disable-next-line typescript/no-misused-spread
      ...base,
      customerId: order.customerId,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      cancelledBy: staffRef(names, order.cancelledById),
      payments: order.payments.map((p) => toAdminPayment(p, names)),
      adminShipment: order.shipment
        ? {
            // toShipment devuelve un objeto plano.
            // oxlint-disable-next-line typescript/no-misused-spread
            ...toShipment(order.shipment),
            courierId: order.shipment.courierId,
            courierCost: order.shipment.courierCost?.toFixed(2) ?? null,
            notes: order.shipment.notes,
          }
        : null,
      reservations: order.items.flatMap((item) =>
        item.reservations.map((r) => ({
          orderItemId: item.id,
          productName: item.productName,
          lotId: r.lotId,
          lotNumber: r.lot.lotNumber,
          expirationDate: formatDateOnly(r.lot.expirationDate),
          quantity: r.quantity,
          status: r.status,
        })),
      ),
      returns: order.returns.map((r) => toReturnDto(r, names)),
      returnDeadline: deadline,
      actions: actionsFor(
        order.status,
        deadline !== null && todayInBusinessZone() <= deadline,
        order.items.some((i) => i.quantityReturned < i.quantity),
      ),
    };
  }

  async staffNames(ids: Array<string | null | undefined>): Promise<StaffNames> {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    if (unique.length === 0) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, firstName: true, lastName: true },
    });
    return new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  }
}

function actionsFor(
  status: OrderStatus,
  withinReturnWindow: boolean,
  hasReturnableUnits: boolean,
): OrderAction[] {
  const actions: OrderAction[] = [];
  if (status === OrderStatus.PENDING_CONFIRMATION) actions.push('confirm');
  if (status === OrderStatus.CONFIRMED) actions.push('prepare');
  if (status === OrderStatus.PREPARING) actions.push('dispatch');
  if (status === OrderStatus.SHIPPED)
    actions.push('addEvent', 'deliver', 'fail');
  if (status === OrderStatus.DELIVERY_FAILED)
    actions.push('redispatch', 'returnToStore');
  if (STAFF_CANCELLABLE.includes(status)) actions.push('cancel');
  if (
    status === OrderStatus.DELIVERED &&
    withinReturnWindow &&
    hasReturnableUnits
  )
    actions.push('createReturn');
  return actions;
}

export function staffRef(
  names: StaffNames,
  id: string | null | undefined,
): StaffRefDto | null {
  return id ? { id, name: names.get(id) ?? 'Usuario' } : null;
}

function toSummary(
  o: Prisma.OrderGetPayload<object>,
  items: ReadonlyArray<{ quantity: number }>,
): OrderSummaryDto {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    paymentMethod: o.paymentMethod,
    placedAt: o.placedAt.toISOString(),
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    total: o.total.toFixed(2),
  };
}

function toShipment(s: NonNullable<DetailRow['shipment']>): OrderShipmentDto {
  return {
    courierName: s.courier.name,
    trackingNumber: s.trackingNumber,
    trackingUrl: trackingUrl(s.courier.trackingUrlTemplate, s.trackingNumber),
    status: s.status,
    dispatchedAt: s.dispatchedAt.toISOString(),
    deliveredAt: s.deliveredAt?.toISOString() ?? null,
    receivedByName: s.receivedByName,
    events: s.events.map((e) => ({
      status: e.status,
      description: e.description,
      location: e.location,
      occurredAt: e.occurredAt.toISOString(),
    })),
  };
}

export function toDetail(o: DetailRow): OrderDetailDto {
  const payment =
    o.payments.find((p) => OPEN_PAYMENT.includes(p.status)) ?? o.payments[0];
  const rejected = o.payments.find((p) => p.status === PaymentStatus.REJECTED);
  const pendingTransfer =
    o.status === OrderStatus.PENDING_PAYMENT &&
    o.paymentMethod === PaymentMethod.BANK_TRANSFER;
  return {
    // toSummary devuelve un objeto plano; el tipo es una clase solo por Swagger.
    // oxlint-disable-next-line typescript/no-misused-spread
    ...toSummary(o, o.items),
    reservationExpiresAt: o.reservationExpiresAt?.toISOString() ?? null,
    billingTaxId: o.billingTaxId,
    billingName: o.billingName,
    shipping: {
      recipientName: o.shipRecipientName,
      phone: o.shipPhone,
      addressLine1: o.shipAddressLine1,
      addressLine2: o.shipAddressLine2,
      zone: o.shipZone,
      municipality: o.shipMunicipality,
      department: o.shipDepartment,
      reference: o.shipReference,
      methodName: o.shippingMethodName,
      cost: o.shippingCost.toFixed(2),
    },
    payment: payment
      ? {
          method: payment.method,
          status: payment.status,
          amount: payment.amount.toFixed(2),
          bankName: payment.bankAccount?.bankName ?? null,
          bankReference: payment.bankReference,
          transferDate: formatDateOnly(payment.transferDate),
        }
      : null,
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      sku: i.sku,
      productName: i.productName,
      presentationLabel: i.presentationLabel,
      concentrationLabel: i.concentrationLabel,
      unitPrice: i.unitPrice.toFixed(2),
      unitDiscount: i.unitDiscount.toFixed(2),
      quantity: i.quantity,
      lineTotal: i.lineTotal.toFixed(2),
      lineTax: i.lineTax.toFixed(2),
      quantityReturned: i.quantityReturned,
    })),
    subtotal: o.subtotal.toFixed(2),
    discountTotal: o.discountTotal.toFixed(2),
    taxTotal: o.taxTotal.toFixed(2),
    shippingCost: o.shippingCost.toFixed(2),
    customerNotes: o.customerNotes,
    history: o.statusHistory.map((h) => ({
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      note: h.note,
      createdAt: h.createdAt.toISOString(),
    })),
    cancelledAt: o.cancelledAt?.toISOString() ?? null,
    cancelReason: o.cancelReason,
    shipment: o.shipment ? toShipment(o.shipment) : null,
    receipt: o.invoice
      ? {
          id: o.invoice.id,
          number: o.invoice.number,
          status: o.invoice.status,
          issuedAt: o.invoice.issuedAt.toISOString(),
          felStatus: o.invoice.felStatus,
          felSeries: o.invoice.felSeries,
          felNumber: o.invoice.felNumber,
        }
      : null,
    paymentRejectionReason:
      pendingTransfer && rejected ? rejected.rejectionReason : null,
    canCancel: CUSTOMER_CANCELLABLE.includes(o.status),
    canSubmitTransfer:
      pendingTransfer &&
      !!o.reservationExpiresAt &&
      o.reservationExpiresAt > new Date(),
  };
}

/** Monto efectivamente recibido: lo cobrado (contra entrega) o lo transferido. */
export function paidAmount(p: {
  method: PaymentMethod;
  status: PaymentStatus;
  amount: Prisma.Decimal;
  collectedAmount: Prisma.Decimal | null;
}): Prisma.Decimal {
  if (
    p.status !== PaymentStatus.APPROVED &&
    p.status !== PaymentStatus.PARTIALLY_REFUNDED &&
    p.status !== PaymentStatus.REFUNDED
  ) {
    return new Decimal(0);
  }
  return p.method === PaymentMethod.CASH_ON_DELIVERY
    ? (p.collectedAmount ?? new Decimal(0))
    : p.amount;
}

export function toRefundDto(r: RefundRow, names: StaffNames): RefundDto {
  return {
    id: r.id,
    paymentId: r.paymentId,
    orderId: r.payment.orderId,
    orderNumber: r.payment.order.number,
    returnId: r.returnId,
    returnNumber: r.return?.number ?? null,
    amount: r.amount.toFixed(2),
    method: r.method,
    reference: r.reference,
    reason: r.reason,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    processedAt: r.processedAt?.toISOString() ?? null,
    processedBy: staffRef(names, r.processedById),
  };
}

export function toAdminPayment(
  p: PaymentRow,
  names: StaffNames,
): AdminPaymentDto {
  const sum = (status: RefundStatus) =>
    p.refunds
      .filter((r) => r.status === status)
      .reduce((acc, r) => acc.add(r.amount), new Decimal(0));
  const completed = sum(RefundStatus.COMPLETED);
  const refundable = paidAmount(p)
    .sub(completed)
    .sub(sum(RefundStatus.PENDING));
  return {
    id: p.id,
    method: p.method,
    status: p.status,
    amount: p.amount.toFixed(2),
    bankAccount: p.bankAccount,
    bankReference: p.bankReference,
    transferDate: formatDateOnly(p.transferDate),
    hasProof: p.proofFileId !== null,
    proofMimeType: p.proofFile?.mimeType ?? null,
    submittedAt: p.submittedAt?.toISOString() ?? null,
    verifiedBy: staffRef(names, p.verifiedById),
    verifiedAt: p.verifiedAt?.toISOString() ?? null,
    rejectionReason: p.rejectionReason,
    collectedAmount: p.collectedAmount?.toFixed(2) ?? null,
    collectedBy: staffRef(names, p.collectedById),
    collectedAt: p.collectedAt?.toISOString() ?? null,
    collectionNote: p.collectionNote,
    refundedAmount: completed.toFixed(2),
    refundableAmount: Decimal.max(refundable, 0).toFixed(2),
    refunds: p.refunds.map((r) => toRefundDto(r, names)),
    history: p.statusHistory.map((h) => ({
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      note: h.note,
      createdAt: h.createdAt.toISOString(),
    })),
    createdAt: p.createdAt.toISOString(),
  };
}

export function toReturnDto(r: ReturnRow, names: StaffNames): ReturnDto {
  const items = r.items.map((i) => {
    const amount = i.orderItem.unitPrice
      .sub(i.orderItem.unitDiscount)
      .mul(i.quantity);
    return {
      id: i.id,
      orderItemId: i.orderItemId,
      productName: i.orderItem.productName,
      sku: i.orderItem.sku,
      lotId: i.lotId,
      lotNumber: i.lot.lotNumber,
      quantity: i.quantity,
      amount: amount.toFixed(2),
      disposition: i.disposition,
      conditionNotes: i.conditionNotes,
      inspectedAt: i.inspectedAt?.toISOString() ?? null,
      inspectedBy: staffRef(names, i.inspectedById),
    };
  });
  return {
    id: r.id,
    number: r.number,
    orderId: r.orderId,
    orderNumber: r.order.number,
    customerName: r.order.customerName,
    status: r.status,
    reason: r.reason,
    notes: r.notes,
    rejectedReason: r.rejectedReason,
    createdBy: staffRef(names, r.createdById),
    createdAt: r.createdAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
    receivedAt: r.receivedAt?.toISOString() ?? null,
    closedAt: r.closedAt?.toISOString() ?? null,
    items,
    amount: items
      .reduce((acc, i) => acc.add(i.amount), new Decimal(0))
      .toFixed(2),
    refunds: r.refunds.map((f) => toRefundDto(f, names)),
  };
}
