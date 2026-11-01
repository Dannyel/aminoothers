import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ReadStream } from 'node:fs';
import {
  addDays,
  dateOnly,
  todayInBusinessZone,
} from '../../common/utils/dates.js';
import { Decimal } from '../../common/utils/money.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  FilePurpose,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InvoicesService } from '../billing/invoices.service.js';
import { FilesService, type UploadedContent } from '../files/files.service.js';
import type {
  PaymentPageDto,
  RefundDto,
  RefundPageDto,
} from './dto/orders.dto.js';
import type {
  CreateRefundDto,
  PaymentsQueryDto,
  RefundsQueryDto,
  SubmitTransferDto,
} from './dto/sales.dto.js';
import {
  assertStatus,
  lockOrder,
  transitionOrder,
  transitionPayment,
} from './order-status.js';
import {
  OrdersService,
  paidAmount,
  paymentInclude,
  toAdminPayment,
  toRefundDto,
} from './orders.service.js';

type Tx = Prisma.TransactionClient;
const TX_OPTIONS = { maxWait: 5_000, timeout: 15_000 };

/** Antigüedad máxima de la fecha de transferencia que se acepta. */
const MAX_TRANSFER_AGE_DAYS = 30;

/**
 * Pagos manuales: transferencias que verifica el personal y reembolsos.
 * Nunca se guardan datos de tarjetas. Para agregar una pasarela basta con
 * otro `provider` en `payments` y su propio flujo de confirmación.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly orders: OrdersService,
    private readonly invoices: InvoicesService,
  ) {}

  // ─── Transferencias ────────────────────────────────────────────────────────

  /**
   * El cliente registra su transferencia con el comprobante. El pago pasa a
   * verificación y el pedido a "pago en revisión" (la reserva ya no vence).
   */
  async submitTransfer(
    customerId: string,
    orderId: string,
    upload: UploadedContent | undefined,
    dto: SubmitTransferDto,
  ): Promise<void> {
    const today = todayInBusinessZone();
    if (dto.transferDate > today) {
      throw new BadRequestException(
        'La fecha de la transferencia no puede ser futura',
      );
    }
    if (dto.transferDate < addDays(today, -MAX_TRANSFER_AGE_DAYS)) {
      throw new BadRequestException(
        `La fecha de la transferencia no puede tener más de ${MAX_TRANSFER_AGE_DAYS} días`,
      );
    }
    const account = await this.prisma.bankAccount.findFirst({
      where: { id: dto.bankAccountId, deletedAt: null, isActive: true },
    });
    if (!account)
      throw new NotFoundException(
        'La cuenta bancaria no existe o está inactiva',
      );

    // Se valida el pedido antes de guardar el archivo para no dejar huérfanos.
    await this.assertCanSubmit(this.prisma, customerId, orderId);
    const file = await this.files.savePrivateDocument(
      upload,
      FilePurpose.PAYMENT_PROOF,
      customerId,
    );
    try {
      await this.prisma.$transaction(async (tx) => {
        const order = await lockOrder(tx, orderId, customerId);
        const payment = await this.assertCanSubmit(tx, customerId, orderId);
        await this.assertReferenceFree(tx, account.id, dto.bankReference);
        await transitionPayment(
          tx,
          payment,
          PaymentStatus.IN_REVIEW,
          customerId,
          'Comprobante de transferencia registrado',
          {
            bankAccount: { connect: { id: account.id } },
            bankReference: dto.bankReference,
            transferDate: dateOnly(dto.transferDate),
            proofFile: { connect: { id: file.id } },
            submittedAt: new Date(),
          },
        );
        await transitionOrder(
          tx,
          order,
          OrderStatus.PAYMENT_IN_REVIEW,
          customerId,
          `Transferencia ${dto.bankReference} en verificación`,
        );
      }, TX_OPTIONS);
    } catch (error) {
      await this.files.remove(file);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw duplicateReference();
      }
      throw error;
    }
  }

  /** Verificación manual contra el estado de cuenta: confirma el pedido. */
  async approve(actorId: string, paymentId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const { order, payment } = await this.lockForReview(tx, paymentId);
      await transitionPayment(
        tx,
        payment,
        PaymentStatus.APPROVED,
        actorId,
        'Transferencia verificada',
        {
          verifiedById: actorId,
          verifiedAt: new Date(),
        },
      );
      await transitionOrder(
        tx,
        order,
        OrderStatus.CONFIRMED,
        actorId,
        'Pago verificado',
      );
      // Comprobante interno al confirmarse el pago (reglas de negocio §9).
      await this.invoices.issueForOrder(tx, order.id, actorId);
    }, TX_OPTIONS);
  }

  /**
   * Rechazo con motivo. El pago rechazado queda en el historial; se abre un
   * pago nuevo para el reintento y el cliente tiene otro plazo completo (D3).
   */
  async reject(
    actorId: string,
    paymentId: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const { order, payment } = await this.lockForReview(tx, paymentId);
      await transitionPayment(
        tx,
        payment,
        PaymentStatus.REJECTED,
        actorId,
        reason,
        {
          verifiedById: actorId,
          verifiedAt: new Date(),
          rejectionReason: reason,
        },
      );
      const settings = await tx.storeSettings.findUniqueOrThrow({
        where: { id: 1 },
      });
      const retry = await tx.payment.create({
        data: {
          orderId: order.id,
          method: PaymentMethod.BANK_TRANSFER,
          amount: order.total,
        },
      });
      await tx.paymentStatusHistory.create({
        data: {
          paymentId: retry.id,
          toStatus: PaymentStatus.PENDING,
          changedById: actorId,
          note: 'Nuevo intento tras un comprobante rechazado',
        },
      });
      await transitionOrder(
        tx,
        order,
        OrderStatus.PENDING_PAYMENT,
        actorId,
        `Comprobante rechazado: ${reason}`.slice(0, 500),
        {
          reservationExpiresAt: new Date(
            Date.now() + settings.transferReservationHours * 3_600_000,
          ),
        },
      );
    }, TX_OPTIONS);
  }

  async list(query: PaymentsQueryDto): Promise<PaymentPageDto> {
    const where: Prisma.PaymentWhereInput = {
      status: query.status,
      ...(query.method ? { method: query.method } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: {
          ...paymentInclude,
          order: {
            select: {
              id: true,
              number: true,
              status: true,
              customerName: true,
              customerEmail: true,
              total: true,
            },
          },
        },
        orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);
    const names = await this.orders.staffNames(
      rows.flatMap((p) => [
        p.verifiedById,
        p.collectedById,
        ...p.refunds.map((r) => r.processedById),
      ]),
    );
    return {
      items: rows.map((p) => ({
        // toAdminPayment devuelve un objeto plano; el tipo es una clase solo por Swagger.
        // oxlint-disable-next-line typescript/no-misused-spread
        ...toAdminPayment(p, names),
        order: {
          id: p.order.id,
          number: p.order.number,
          status: p.order.status,
          customerName: p.order.customerName,
          customerEmail: p.order.customerEmail,
          total: p.order.total.toFixed(2),
        },
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Comprobante para quien verifica (archivo privado). */
  async openProof(
    paymentId: string,
  ): Promise<{ mimeType: string; sizeBytes: number; stream: ReadStream }> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { proofFileId: true },
    });
    if (!payment?.proofFileId)
      throw new NotFoundException('El pago no tiene comprobante');
    const { file, stream } = await this.files.openPrivate(payment.proofFileId);
    return { mimeType: file.mimeType, sizeBytes: file.sizeBytes, stream };
  }

  // ─── Reembolsos ────────────────────────────────────────────────────────────

  /** Registra un reembolso pendiente; nunca supera lo que falta por reembolsar. */
  async createRefund(
    actorId: string,
    paymentId: string,
    dto: CreateRefundDto,
  ): Promise<RefundDto> {
    const id = await this.prisma.$transaction(async (tx) => {
      const payment = await this.lockPayment(tx, paymentId);
      if (
        payment.status !== PaymentStatus.APPROVED &&
        payment.status !== PaymentStatus.PARTIALLY_REFUNDED
      ) {
        throw new ConflictException('Solo se reembolsan pagos aprobados');
      }
      if (dto.returnId) {
        const ret = await tx.return.findFirst({
          where: { id: dto.returnId, orderId: payment.orderId },
        });
        if (!ret)
          throw new NotFoundException(
            'La devolución no pertenece a este pedido',
          );
      }
      const committed = await this.committedRefunds(tx, paymentId);
      const remaining = paidAmount(payment).sub(committed);
      const amount = new Decimal(dto.amount);
      if (amount.lte(0) || amount.gt(remaining)) {
        throw new BadRequestException(
          `El reembolso debe ser mayor que cero y no superar Q${remaining.toFixed(2)}`,
        );
      }
      const refund = await tx.refund.create({
        data: {
          paymentId,
          returnId: dto.returnId ?? null,
          amount,
          method: dto.method,
          reason: dto.reason,
          createdById: actorId,
        },
      });
      return refund.id;
    }, TX_OPTIONS);
    return this.refund(id);
  }

  /** Reembolso hecho: queda la referencia y el pago se marca reembolsado (total o parcial). */
  async completeRefund(
    actorId: string,
    refundId: string,
    reference: string,
  ): Promise<RefundDto> {
    await this.prisma.$transaction(async (tx) => {
      const refund = await this.pendingRefund(tx, refundId);
      const payment = await this.lockPayment(tx, refund.paymentId);
      await tx.refund.update({
        where: { id: refundId },
        data: {
          status: RefundStatus.COMPLETED,
          reference,
          processedById: actorId,
          processedAt: new Date(),
        },
      });
      const completed = await tx.refund.aggregate({
        where: { paymentId: payment.id, status: RefundStatus.COMPLETED },
        _sum: { amount: true },
      });
      const total = completed._sum.amount ?? new Decimal(0);
      const next = total.gte(paidAmount(payment))
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIALLY_REFUNDED;
      if (next !== payment.status) {
        await transitionPayment(
          tx,
          payment,
          next,
          actorId,
          `Reembolso ${reference}`,
        );
      }
    }, TX_OPTIONS);
    return this.refund(refundId);
  }

  async cancelRefund(actorId: string, refundId: string): Promise<RefundDto> {
    await this.prisma.$transaction(async (tx) => {
      const refund = await this.pendingRefund(tx, refundId);
      await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: RefundStatus.CANCELLED,
          processedById: actorId,
          processedAt: new Date(),
        },
      });
    }, TX_OPTIONS);
    return this.refund(refundId);
  }

  async listRefunds(query: RefundsQueryDto): Promise<RefundPageDto> {
    const where: Prisma.RefundWhereInput = query.status
      ? { status: query.status }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.refund.findMany({
        where,
        include: paymentInclude.refunds.include,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.refund.count({ where }),
    ]);
    const names = await this.orders.staffNames(
      rows.map((r) => r.processedById),
    );
    return {
      items: rows.map((r) => toRefundDto(r, names)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  // ─── Internos ──────────────────────────────────────────────────────────────

  private async refund(id: string): Promise<RefundDto> {
    const row = await this.prisma.refund.findUniqueOrThrow({
      where: { id },
      include: paymentInclude.refunds.include,
    });
    return toRefundDto(row, await this.orders.staffNames([row.processedById]));
  }

  private async assertCanSubmit(
    tx: Tx | PrismaService,
    customerId: string,
    orderId: string,
  ) {
    const order = await tx.order.findFirst({
      where: { id: orderId, customerId },
      select: {
        status: true,
        paymentMethod: true,
        reservationExpiresAt: true,
      },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    if (order.paymentMethod !== PaymentMethod.BANK_TRANSFER) {
      throw new ConflictException('El pedido no se paga por transferencia');
    }
    assertStatus(order, [OrderStatus.PENDING_PAYMENT], 'registrar el pago');
    if (
      !order.reservationExpiresAt ||
      order.reservationExpiresAt <= new Date()
    ) {
      throw new ConflictException('Venció el plazo para pagar este pedido');
    }
    const payment = await tx.payment.findFirst({
      where: { orderId, status: PaymentStatus.PENDING },
      select: { id: true, status: true },
    });
    if (!payment)
      throw new ConflictException('El pedido no tiene un pago pendiente');
    return payment;
  }

  private async assertReferenceFree(
    tx: Tx,
    bankAccountId: string,
    bankReference: string,
  ): Promise<void> {
    const used = await tx.payment.findFirst({
      where: {
        bankAccountId,
        bankReference,
        status: { notIn: [PaymentStatus.REJECTED, PaymentStatus.CANCELLED] },
      },
    });
    if (used) throw duplicateReference();
  }

  private async lockForReview(tx: Tx, paymentId: string) {
    const found = await tx.payment.findUnique({
      where: { id: paymentId },
      select: { orderId: true },
    });
    if (!found) throw new NotFoundException('Pago no encontrado');
    const order = await lockOrder(tx, found.orderId);
    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: { id: true, status: true },
    });
    if (payment.status !== PaymentStatus.IN_REVIEW) {
      throw new ConflictException('El pago no está pendiente de verificación');
    }
    return { order, payment };
  }

  private async lockPayment(tx: Tx, id: string) {
    const [row] = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM payments WHERE id = ${id}::uuid FOR UPDATE`;
    if (!row) throw new NotFoundException('Pago no encontrado');
    return tx.payment.findUniqueOrThrow({ where: { id } });
  }

  private async committedRefunds(tx: Tx, paymentId: string) {
    const sum = await tx.refund.aggregate({
      where: {
        paymentId,
        status: { in: [RefundStatus.PENDING, RefundStatus.COMPLETED] },
      },
      _sum: { amount: true },
    });
    return sum._sum.amount ?? new Decimal(0);
  }

  private async pendingRefund(tx: Tx, id: string) {
    const [row] = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM refunds WHERE id = ${id}::uuid FOR UPDATE`;
    if (!row) throw new NotFoundException('Reembolso no encontrado');
    const refund = await tx.refund.findUniqueOrThrow({ where: { id } });
    if (refund.status !== RefundStatus.PENDING) {
      throw new ConflictException('El reembolso ya fue procesado');
    }
    return refund;
  }
}

const duplicateReference = () =>
  new ConflictException(
    'Esa referencia ya fue registrada para la misma cuenta. Verifique el número de su transferencia.',
  );
