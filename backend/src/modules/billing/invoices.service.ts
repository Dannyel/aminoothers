import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { addDays, businessDayStart } from '../../common/utils/dates.js';
import { Decimal } from '../../common/utils/money.js';
import { Prisma } from '../../generated/prisma/client.js';
import { FelStatus, InvoiceStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  IncomeReportDto,
  InvoiceDto,
  InvoicePageDto,
  InvoicesQueryDto,
  RegisterFelDto,
} from './dto/billing.dto.js';

type Tx = Prisma.TransactionClient;

/** Leyenda de todo comprobante interno: no se presenta como factura. */
export const INTERNAL_RECEIPT_LEGEND =
  'Documento interno — no constituye factura ni documento tributario. La factura electrónica (FEL) se emite por separado.';

const include = {
  items: { orderBy: { isGood: 'desc' } },
  order: { select: { number: true } },
} satisfies Prisma.InvoiceInclude;

type Row = Prisma.InvoiceGetPayload<{ include: typeof include }>;

/**
 * Comprobantes de venta (D11). Sin integración FEL se emite un comprobante
 * interno al confirmarse el pago (o al entregar contra entrega); los datos de
 * la FEL que la farmacia emite en el portal del certificador se registran
 * aquí. Nunca se genera un documento con apariencia de factura FEL.
 */
@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Emite el comprobante del pedido dentro de la transacción del pago. Idempotente. */
  async issueForOrder(
    tx: Tx,
    orderId: string,
    actorId: string | null,
  ): Promise<void> {
    const existing = await tx.invoice.findUnique({ where: { orderId } });
    if (existing) return;
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { orderBy: { productName: 'asc' } } },
    });
    const items: Prisma.InvoiceItemCreateWithoutInvoiceInput[] =
      order.items.map((i) => ({
        orderItem: { connect: { id: i.id } },
        description: [i.productName, i.presentationLabel, i.concentrationLabel]
          .filter(Boolean)
          .join(' · ')
          .slice(0, 300),
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.lineDiscount,
        taxAmount: i.lineTax,
        lineTotal: i.lineTotal,
        isGood: true,
      }));
    if (order.shippingCost.gt(0)) {
      items.push({
        description: `Envío: ${order.shippingMethodName}`,
        quantity: 1,
        unitPrice: order.shippingCost,
        discount: new Decimal(0),
        taxAmount: order.shippingTax,
        lineTotal: order.shippingCost,
        isGood: false,
      });
    }
    await tx.invoice.create({
      data: {
        orderId,
        issuedById: actorId,
        customerTaxId: order.billingTaxId,
        customerName: order.billingName,
        customerAddress: [
          order.shipAddressLine1,
          order.shipAddressLine2,
          order.shipZone ? `zona ${order.shipZone}` : null,
          order.shipMunicipality,
          order.shipDepartment,
        ]
          .filter(Boolean)
          .join(', ')
          .slice(0, 500),
        currency: order.currency,
        subtotal: order.subtotal.add(order.shippingCost),
        discountTotal: order.discountTotal,
        taxTotal: order.taxTotal,
        total: order.total,
        items: { create: items },
      },
    });
  }

  /**
   * Anula el comprobante vigente del pedido (p. ej. al cancelarlo). Si ya se
   * registró una FEL, la anulación ante el certificador se hace aparte.
   */
  async voidForOrder(
    tx: Tx,
    orderId: string,
    actorId: string,
    reason: string,
  ): Promise<void> {
    const invoice = await tx.invoice.findUnique({ where: { orderId } });
    if (!invoice || invoice.status !== InvoiceStatus.ISSUED) return;
    await this.markVoided(tx, invoice.id, invoice.felStatus, actorId, reason);
  }

  async void(actorId: string, id: string, reason: string): Promise<InvoiceDto> {
    await this.prisma.$transaction(async (tx) => {
      const invoice = await this.lock(tx, id);
      if (invoice.status !== InvoiceStatus.ISSUED) {
        throw new ConflictException('El comprobante ya está anulado');
      }
      await this.markVoided(tx, id, invoice.felStatus, actorId, reason);
    });
    return this.get(id);
  }

  /** Registra los datos de la FEL emitida externamente para este comprobante. */
  async registerFel(
    actorId: string,
    id: string,
    dto: RegisterFelDto,
  ): Promise<InvoiceDto> {
    const certifiedAt = new Date(dto.certifiedAt);
    if (certifiedAt > new Date(Date.now() + 5 * 60_000)) {
      throw new BadRequestException(
        'La fecha de certificación no puede ser futura',
      );
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        const invoice = await this.lock(tx, id);
        if (invoice.status !== InvoiceStatus.ISSUED) {
          throw new ConflictException(
            'No se registra FEL en un comprobante anulado',
          );
        }
        await tx.invoice.update({
          where: { id },
          data: {
            felStatus: FelStatus.CERTIFIED,
            felAuthorizationUuid: dto.authorizationUuid.toLowerCase(),
            felSeries: dto.series.toUpperCase(),
            felNumber: dto.number,
            felCertifier: dto.certifier,
            felCertifiedAt: certifiedAt,
            felRegisteredById: actorId,
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ese número de autorización FEL ya está registrado en otro comprobante',
        );
      }
      throw error;
    }
    return this.get(id);
  }

  async list(query: InvoicesQueryDto): Promise<InvoicePageDto> {
    const where: Prisma.InvoiceWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.felStatus ? { felStatus: query.felStatus } : {}),
      ...(query.from || query.to
        ? {
            issuedAt: {
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
      const number = Number(search.replace(/^(CI|PED)-?/i, ''));
      where.OR = [
        ...(Number.isInteger(number) && number > 0
          ? [{ number }, { order: { number } }]
          : []),
        { customerName: { contains: search, mode: 'insensitive' } },
        {
          customerTaxId: { equals: search.replace(/[\s-]/g, '').toUpperCase() },
        },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include,
        orderBy: { issuedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return {
      items: rows.map(toDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<InvoiceDto> {
    const row = await this.prisma.invoice.findUnique({
      where: { id },
      include,
    });
    if (!row) throw new NotFoundException('Comprobante no encontrado');
    return toDto(row);
  }

  async getForCustomer(
    customerId: string,
    orderId: string,
  ): Promise<InvoiceDto> {
    const row = await this.prisma.invoice.findFirst({
      where: { orderId, order: { customerId } },
      include,
    });
    if (!row) throw new NotFoundException('El pedido aún no tiene comprobante');
    return toDto(row);
  }

  /**
   * Ingresos del periodo: pagos aprobados o cobrados menos reembolsos
   * completados, más lo facturado. No es contabilidad de partida doble.
   */
  async income(from: string, to: string): Promise<IncomeReportDto> {
    if (to < from)
      throw new BadRequestException('El rango de fechas es inválido');
    const start = businessDayStart(from);
    const end = businessDayStart(addDays(to, 1));
    const [[received], [refunds], [issued], [voided], felPending] =
      await Promise.all([
        this.prisma.$queryRaw<
          Array<{ transfer: string; cod: string; count: number }>
        >`
        SELECT
          COALESCE(sum(amount) FILTER (WHERE method = 'BANK_TRANSFER'), 0)::text AS transfer,
          COALESCE(sum(collected_amount) FILTER (WHERE method = 'CASH_ON_DELIVERY'), 0)::text AS cod,
          count(*)::int AS count
        FROM payments
        WHERE status IN ('APPROVED', 'PARTIALLY_REFUNDED', 'REFUNDED')
          AND COALESCE(verified_at, collected_at) >= ${start}
          AND COALESCE(verified_at, collected_at) < ${end}`,
        this.prisma.$queryRaw<Array<{ total: string; count: number }>>`
        SELECT COALESCE(sum(amount), 0)::text AS total, count(*)::int AS count
        FROM refunds
        WHERE status = 'COMPLETED' AND processed_at >= ${start} AND processed_at < ${end}`,
        this.prisma.$queryRaw<
          Array<{ count: number; total: string; tax: string }>
        >`
        SELECT count(*)::int AS count, COALESCE(sum(total), 0)::text AS total,
               COALESCE(sum(tax_total), 0)::text AS tax
        FROM invoices
        WHERE status = 'ISSUED' AND issued_at >= ${start} AND issued_at < ${end}`,
        this.prisma.$queryRaw<Array<{ count: number; total: string }>>`
        SELECT count(*)::int AS count, COALESCE(sum(total), 0)::text AS total
        FROM invoices
        WHERE status = 'VOIDED' AND voided_at >= ${start} AND voided_at < ${end}`,
        this.prisma.invoice.count({
          where: { status: InvoiceStatus.ISSUED, felStatus: FelStatus.PENDING },
        }),
      ]);
    const total = new Decimal(received.transfer).add(received.cod);
    return {
      from,
      to,
      received: total.toFixed(2),
      receivedByMethod: {
        bankTransfer: new Decimal(received.transfer).toFixed(2),
        cashOnDelivery: new Decimal(received.cod).toFixed(2),
      },
      receivedCount: received.count,
      refunded: new Decimal(refunds.total).toFixed(2),
      refundedCount: refunds.count,
      net: total.sub(refunds.total).toFixed(2),
      invoicesIssued: issued.count,
      invoicedTotal: new Decimal(issued.total).toFixed(2),
      invoicedTax: new Decimal(issued.tax).toFixed(2),
      invoicesVoided: voided.count,
      voidedTotal: new Decimal(voided.total).toFixed(2),
      felPending,
    };
  }

  private async markVoided(
    tx: Tx,
    id: string,
    felStatus: FelStatus,
    actorId: string,
    reason: string,
  ): Promise<void> {
    await tx.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.VOIDED,
        voidedAt: new Date(),
        voidReason: reason.slice(0, 500),
        voidedById: actorId,
        // Sin FEL emitida ya no corresponde emitirla.
        ...(felStatus === FelStatus.PENDING
          ? { felStatus: FelStatus.NOT_APPLICABLE }
          : {}),
      },
    });
  }

  private async lock(tx: Tx, id: string) {
    const [row] = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM invoices WHERE id = ${id}::uuid FOR UPDATE`;
    if (!row) throw new NotFoundException('Comprobante no encontrado');
    return tx.invoice.findUniqueOrThrow({ where: { id } });
  }
}

function toDto(r: Row): InvoiceDto {
  return {
    id: r.id,
    number: r.number,
    orderId: r.orderId,
    orderNumber: r.order.number,
    kind: r.kind,
    status: r.status,
    issuedAt: r.issuedAt.toISOString(),
    voidedAt: r.voidedAt?.toISOString() ?? null,
    voidReason: r.voidReason,
    customerTaxId: r.customerTaxId,
    customerName: r.customerName,
    customerAddress: r.customerAddress,
    currency: r.currency,
    subtotal: r.subtotal.toFixed(2),
    discountTotal: r.discountTotal.toFixed(2),
    taxTotal: r.taxTotal.toFixed(2),
    total: r.total.toFixed(2),
    items: r.items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice.toFixed(2),
      discount: i.discount.toFixed(2),
      taxAmount: i.taxAmount.toFixed(2),
      lineTotal: i.lineTotal.toFixed(2),
      isGood: i.isGood,
    })),
    fel: {
      status: r.felStatus,
      authorizationUuid: r.felAuthorizationUuid,
      series: r.felSeries,
      number: r.felNumber,
      certifier: r.felCertifier,
      certifiedAt: r.felCertifiedAt?.toISOString() ?? null,
    },
    legend: INTERNAL_RECEIPT_LEGEND,
  };
}
