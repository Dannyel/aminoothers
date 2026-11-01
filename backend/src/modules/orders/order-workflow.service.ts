import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from '../../common/utils/money.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RefundMethod,
  ReservationStatus,
  ShipmentStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InvoicesService } from '../billing/invoices.service.js';
import { ReservationsService } from '../inventory/reservations.service.js';
import type {
  DeliverOrderDto,
  DispatchOrderDto,
  RedispatchOrderDto,
  ShipmentEventInputDto,
} from './dto/sales.dto.js';
import {
  assertStatus,
  CUSTOMER_CANCELLABLE,
  lockOrder,
  STAFF_CANCELLABLE,
  transitionOrder,
  transitionPayment,
  type LockedOrder,
} from './order-status.js';
import { orderLabel } from './order-label.js';
import { ReturnsService } from './returns.service.js';

type Tx = Prisma.TransactionClient;
const TX_OPTIONS = { maxWait: 5_000, timeout: 15_000 };

/**
 * Transiciones del pedido realizadas por el personal o el cliente. Cada una
 * bloquea el pedido, valida el estado y registra el historial en una sola
 * transacción; las que mueven inventario o pagos lo hacen en la misma.
 */
@Injectable()
export class OrderWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: ReservationsService,
    private readonly returns: ReturnsService,
    private readonly invoices: InvoicesService,
  ) {}

  /** Contra entrega: el personal verifica el pedido antes de prepararlo. */
  confirm(actorId: string, id: string, note?: string | null): Promise<void> {
    return this.run(id, async (tx, order) => {
      assertStatus(order, [OrderStatus.PENDING_CONFIRMATION], 'confirmar');
      await transitionOrder(
        tx,
        order,
        OrderStatus.CONFIRMED,
        actorId,
        note ?? 'Pedido contra entrega confirmado',
      );
    });
  }

  prepare(actorId: string, id: string, note?: string | null): Promise<void> {
    return this.run(id, async (tx, order) => {
      await transitionOrder(
        tx,
        order,
        OrderStatus.PREPARING,
        actorId,
        note ?? undefined,
      );
    });
  }

  /**
   * Entrega a la mensajería: crea el envío y descuenta del inventario las
   * unidades reservadas (movimientos SALE por lote).
   */
  dispatch(actorId: string, id: string, dto: DispatchOrderDto): Promise<void> {
    return this.run(id, async (tx, order) => {
      assertStatus(order, [OrderStatus.PREPARING], 'despachar');
      const courier = await tx.courier.findFirst({
        where: { id: dto.courierId, deletedAt: null, isActive: true },
      });
      if (!courier)
        throw new NotFoundException('La mensajería no existe o está inactiva');
      await this.assertTrackingFree(tx, courier.id, dto.trackingNumber, id);

      await this.reservations.consumeForOrder(tx, id, actorId);
      await tx.shipment.create({
        data: {
          orderId: id,
          courierId: courier.id,
          trackingNumber: dto.trackingNumber ?? null,
          courierCost: dto.courierCost,
          notes: dto.notes ?? null,
          events: {
            create: {
              status: ShipmentStatus.DISPATCHED,
              description: `Entregado a ${courier.name}`,
              createdById: actorId,
            },
          },
        },
      });
      await transitionOrder(
        tx,
        order,
        OrderStatus.SHIPPED,
        actorId,
        `Despachado con ${courier.name}${dto.trackingNumber ? ` (guía ${dto.trackingNumber})` : ''}`,
      );
    });
  }

  /** Seguimiento manual mientras no haya integración con la mensajería. */
  addEvent(
    actorId: string,
    id: string,
    dto: ShipmentEventInputDto,
  ): Promise<void> {
    return this.run(id, async (tx, order) => {
      assertStatus(order, [OrderStatus.SHIPPED], 'registrar el seguimiento');
      const shipment = await tx.shipment.findUniqueOrThrow({
        where: { orderId: id },
      });
      const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
      if (occurredAt > new Date(Date.now() + 5 * 60_000)) {
        throw new BadRequestException(
          'La fecha del evento no puede ser futura',
        );
      }
      await tx.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          status: dto.status,
          description: dto.description,
          location: dto.location ?? null,
          occurredAt,
          createdById: actorId,
        },
      });
      await tx.shipment.update({
        where: { id: shipment.id },
        data: { status: dto.status },
      });
    });
  }

  /**
   * Entrega confirmada. En contra entrega se registra el cobro en la misma
   * operación: el pago queda aprobado con el monto, quién y cuándo.
   */
  deliver(
    actorId: string,
    actorPermissions: ReadonlySet<string> | 'all',
    id: string,
    dto: DeliverOrderDto,
  ): Promise<void> {
    return this.run(id, async (tx, order) => {
      assertStatus(order, [OrderStatus.SHIPPED], 'registrar la entrega');
      if (order.payment_method === PaymentMethod.CASH_ON_DELIVERY) {
        if (
          actorPermissions !== 'all' &&
          !actorPermissions.has('payments.collect')
        ) {
          throw new ConflictException(
            'Registrar la entrega de un pedido contra entrega requiere el permiso de cobro',
          );
        }
        await this.collect(tx, actorId, order, dto);
      }
      const shipment = await tx.shipment.findUniqueOrThrow({
        where: { orderId: id },
      });
      const now = new Date();
      await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          status: ShipmentStatus.DELIVERED,
          deliveredAt: now,
          receivedByName: dto.receivedByName ?? null,
          events: {
            create: {
              status: ShipmentStatus.DELIVERED,
              description: dto.receivedByName
                ? `Entregado a ${dto.receivedByName}`
                : 'Entregado',
              occurredAt: now,
              createdById: actorId,
            },
          },
        },
      });
      await transitionOrder(
        tx,
        order,
        OrderStatus.DELIVERED,
        actorId,
        dto.note ?? undefined,
      );
      // Contra entrega: el comprobante se emite con el cobro (reglas §9).
      if (order.payment_method === PaymentMethod.CASH_ON_DELIVERY) {
        await this.invoices.issueForOrder(tx, order.id, actorId);
      }
    });
  }

  fail(actorId: string, id: string, note: string): Promise<void> {
    return this.run(id, async (tx, order) => {
      assertStatus(
        order,
        [OrderStatus.SHIPPED],
        'registrar la entrega fallida',
      );
      await this.updateShipment(tx, id, ShipmentStatus.FAILED, note, actorId);
      await transitionOrder(
        tx,
        order,
        OrderStatus.DELIVERY_FAILED,
        actorId,
        note,
      );
    });
  }

  /** Nuevo intento de entrega, con la misma mensajería y opcionalmente otra guía. */
  redispatch(
    actorId: string,
    id: string,
    dto: RedispatchOrderDto,
  ): Promise<void> {
    return this.run(id, async (tx, order) => {
      assertStatus(order, [OrderStatus.DELIVERY_FAILED], 'reenviar');
      const shipment = await tx.shipment.findUniqueOrThrow({
        where: { orderId: id },
      });
      if (dto.trackingNumber) {
        await this.assertTrackingFree(
          tx,
          shipment.courierId,
          dto.trackingNumber,
          id,
        );
        await tx.shipment.update({
          where: { id: shipment.id },
          data: { trackingNumber: dto.trackingNumber },
        });
      }
      const note = dto.note ?? 'Nuevo intento de entrega';
      await this.updateShipment(
        tx,
        id,
        ShipmentStatus.DISPATCHED,
        note,
        actorId,
      );
      await transitionOrder(tx, order, OrderStatus.SHIPPED, actorId, note);
    });
  }

  /**
   * La mensajería devolvió el paquete: se crea una devolución recibida con
   * todas las unidades pendientes de inspección (no vuelven solas al
   * inventario) y se cancela el cobro contra entrega que no ocurrió.
   */
  returnToStore(actorId: string, id: string, note: string): Promise<void> {
    return this.run(id, async (tx, order) => {
      assertStatus(
        order,
        [OrderStatus.DELIVERY_FAILED],
        'registrar la devolución del paquete',
      );
      await this.updateShipment(tx, id, ShipmentStatus.RETURNED, note, actorId);
      await transitionOrder(
        tx,
        order,
        OrderStatus.RETURNED_TO_STORE,
        actorId,
        note,
      );
      await this.returns.createReceivedForWholeOrder(tx, id, actorId, note);
      await this.cancelOpenPayments(
        tx,
        id,
        actorId,
        'Paquete devuelto a la farmacia',
      );
    });
  }

  cancelByCustomer(
    customerId: string,
    id: string,
    reason?: string | null,
  ): Promise<void> {
    return this.run(
      id,
      async (tx, order) => {
        assertStatus(order, CUSTOMER_CANCELLABLE, 'cancelar el pedido');
        await this.cancel(
          tx,
          order,
          customerId,
          reason || 'Cancelado por el cliente',
        );
      },
      customerId,
    );
  }

  cancelByStaff(actorId: string, id: string, reason: string): Promise<void> {
    return this.run(id, async (tx, order) => {
      assertStatus(order, STAFF_CANCELLABLE, 'cancelar el pedido');
      await this.cancel(tx, order, actorId, reason);
    });
  }

  // ─── Internos ──────────────────────────────────────────────────────────────

  private run(
    id: string,
    action: (tx: Tx, order: LockedOrder) => Promise<void>,
    customerId?: string,
  ): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      const order = await lockOrder(tx, id, customerId);
      await action(tx, order);
    }, TX_OPTIONS);
  }

  /**
   * Libera las reservas, cancela los pagos abiertos y, si ya estaba pagado,
   * deja un reembolso pendiente por el total para que Finanzas lo complete.
   */
  private async cancel(
    tx: Tx,
    order: LockedOrder,
    actorId: string,
    reason: string,
  ): Promise<void> {
    await this.reservations.releaseForOrder(
      tx,
      order.id,
      ReservationStatus.RELEASED,
    );
    await this.cancelOpenPayments(tx, order.id, actorId, 'Pedido cancelado');
    const approved = await tx.payment.findFirst({
      where: { orderId: order.id, status: PaymentStatus.APPROVED },
    });
    if (approved) {
      await tx.refund.create({
        data: {
          paymentId: approved.id,
          amount: approved.amount,
          method: RefundMethod.BANK_TRANSFER,
          reason: `Pedido cancelado: ${reason}`.slice(0, 500),
          createdById: actorId,
        },
      });
    }
    await this.invoices.voidForOrder(
      tx,
      order.id,
      actorId,
      `Pedido cancelado: ${reason}`,
    );
    await transitionOrder(tx, order, OrderStatus.CANCELLED, actorId, reason, {
      cancelledAt: new Date(),
      cancelReason: reason,
      cancelledById: actorId,
    });
  }

  private async cancelOpenPayments(
    tx: Tx,
    orderId: string,
    actorId: string,
    note: string,
  ): Promise<void> {
    const open = await tx.payment.findMany({
      where: {
        orderId,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.IN_REVIEW] },
      },
      select: { id: true, status: true },
    });
    for (const payment of open) {
      await transitionPayment(
        tx,
        payment,
        PaymentStatus.CANCELLED,
        actorId,
        note,
      );
    }
  }

  private async collect(
    tx: Tx,
    actorId: string,
    order: LockedOrder,
    dto: DeliverOrderDto,
  ): Promise<void> {
    if (dto.collectedAmount === undefined) {
      throw new BadRequestException(
        'Indique el monto cobrado al entregar el pedido contra entrega',
      );
    }
    const collected = new Decimal(dto.collectedAmount);
    if (!collected.equals(new Decimal(order.total)) && !dto.note) {
      throw new BadRequestException(
        'El monto cobrado difiere del total del pedido: explique la diferencia en la nota',
      );
    }
    const payment = await tx.payment.findFirst({
      where: { orderId: order.id, status: PaymentStatus.PENDING },
      select: { id: true, status: true },
    });
    if (!payment)
      throw new ConflictException('El pedido no tiene un cobro pendiente');
    await transitionPayment(
      tx,
      payment,
      PaymentStatus.APPROVED,
      actorId,
      dto.note ?? 'Cobro contra entrega',
      {
        collectedAmount: collected,
        collectedById: actorId,
        collectedAt: new Date(),
        collectionNote: dto.note ?? null,
      },
    );
  }

  private async updateShipment(
    tx: Tx,
    orderId: string,
    status: ShipmentStatus,
    description: string,
    actorId: string,
  ): Promise<void> {
    const shipment = await tx.shipment.findUniqueOrThrow({
      where: { orderId },
    });
    await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status,
        events: {
          create: {
            status,
            description: description.slice(0, 300),
            createdById: actorId,
          },
        },
      },
    });
  }

  private async assertTrackingFree(
    tx: Tx,
    courierId: string,
    trackingNumber: string | null | undefined,
    orderId: string,
  ): Promise<void> {
    if (!trackingNumber) return;
    const clash = await tx.shipment.findFirst({
      where: { courierId, trackingNumber, orderId: { not: orderId } },
      select: { order: { select: { number: true } } },
    });
    if (clash) {
      throw new ConflictException(
        `La guía ${trackingNumber} ya está registrada en el pedido ${orderLabel(clash.order.number)}`,
      );
    }
  }
}
