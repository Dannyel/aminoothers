import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { paginationArgs } from '../../common/dto/pagination.dto.js';
import { dateOnly, formatDateOnly } from '../../common/utils/dates.js';
import { Decimal, roundMoney } from '../../common/utils/money.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  LotStatus,
  MovementType,
  PurchaseOrderStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { LotsService } from '../inventory/lots.service.js';
import { StockLedgerService } from '../inventory/stock-ledger.service.js';
import type {
  ListPurchaseOrdersQueryDto,
  PurchaseOrderDetailDto,
  PurchaseOrderInputDto,
  PurchaseOrderPageDto,
  PurchaseOrderSummaryDto,
  ReceiptInputDto,
} from './dto/purchasing.dto.js';

type Tx = Prisma.TransactionClient;

const person = {
  select: { id: true, firstName: true, lastName: true },
} as const;
const productRef = { select: { id: true, sku: true, name: true } } as const;

const detailInclude = {
  supplier: { select: { id: true, name: true } },
  items: { include: { product: productRef }, orderBy: { id: 'asc' } },
  receipts: {
    orderBy: { number: 'asc' },
    include: {
      items: {
        include: {
          lot: { select: { id: true, lotNumber: true, expirationDate: true } },
          purchaseOrderItem: { select: { product: productRef } },
        },
      },
    },
  },
} satisfies Prisma.PurchaseOrderInclude;

type DetailRow = Prisma.PurchaseOrderGetPayload<{
  include: typeof detailInclude;
}>;
type SummaryRow = Prisma.PurchaseOrderGetPayload<{
  include: { supplier: { select: { id: true; name: true } } };
}>;

const EDITABLE = new Set<PurchaseOrderStatus>([PurchaseOrderStatus.DRAFT]);
const RECEIVABLE = new Set<PurchaseOrderStatus>([
  PurchaseOrderStatus.APPROVED,
  PurchaseOrderStatus.PARTIALLY_RECEIVED,
]);

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lots: LotsService,
    private readonly ledger: StockLedgerService,
  ) {}

  async list(query: ListPurchaseOrdersQueryDto): Promise<PurchaseOrderPageDto> {
    const number = Number.parseInt(query.search ?? '', 10);
    const where: Prisma.PurchaseOrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.search
        ? {
            OR: [
              ...(Number.isInteger(number) ? [{ number }] : []),
              {
                supplier: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.findMany({
        where,
        include: { supplier: { select: { id: true, name: true } } },
        orderBy: { number: 'desc' },
        ...paginationArgs(query),
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);
    return {
      items: rows.map(toSummary),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<PurchaseOrderDetailDto> {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: detailInclude,
    });
    if (!order) throw new NotFoundException('Orden de compra no encontrada');
    return this.toDetail(order);
  }

  async create(
    actor: AuthUser,
    dto: PurchaseOrderInputDto,
  ): Promise<PurchaseOrderDetailDto> {
    await this.assertSupplier(dto.supplierId);
    const id = await this.prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.create({
        data: {
          supplierId: dto.supplierId,
          expectedDate: dto.expectedDate ? dateOnly(dto.expectedDate) : null,
          notes: dto.notes,
          createdById: actor.id,
        },
      });
      await this.replaceItems(tx, order.id, dto.items);
      return order.id;
    });
    return this.get(id);
  }

  /** Solo en borrador: reemplaza encabezado y líneas. */
  async update(
    id: string,
    dto: PurchaseOrderInputDto,
  ): Promise<PurchaseOrderDetailDto> {
    await this.assertSupplier(dto.supplierId);
    await this.prisma.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, id);
      if (!EDITABLE.has(order.status)) {
        throw new ConflictException(
          'Solo se pueden editar órdenes en borrador',
        );
      }
      await tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierId: dto.supplierId,
          expectedDate: dto.expectedDate ? dateOnly(dto.expectedDate) : null,
          notes: dto.notes,
        },
      });
      await this.replaceItems(tx, id, dto.items);
    });
    return this.get(id);
  }

  async approve(actor: AuthUser, id: string): Promise<PurchaseOrderDetailDto> {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, id);
      if (order.status !== PurchaseOrderStatus.DRAFT) {
        throw new ConflictException('Solo se aprueban órdenes en borrador');
      }
      await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: PurchaseOrderStatus.APPROVED,
          approvedById: actor.id,
          approvedAt: new Date(),
        },
      });
    });
    return this.get(id);
  }

  /** Cancelar solo si no se recibió nada; si hubo recepciones, se cierra. */
  async cancel(id: string): Promise<PurchaseOrderDetailDto> {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, id);
      const allowed: PurchaseOrderStatus[] = [
        PurchaseOrderStatus.DRAFT,
        PurchaseOrderStatus.APPROVED,
      ];
      if (!allowed.includes(order.status)) {
        throw new ConflictException(
          'Solo se cancelan órdenes sin recepciones; una orden recibida parcialmente se cierra',
        );
      }
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: PurchaseOrderStatus.CANCELLED, closedAt: new Date() },
      });
    });
    return this.get(id);
  }

  /** Cierra una orden recibida parcialmente: el faltante ya no se espera. */
  async close(id: string): Promise<PurchaseOrderDetailDto> {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, id);
      if (order.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED) {
        throw new ConflictException(
          'Solo se cierran órdenes recibidas parcialmente',
        );
      }
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: PurchaseOrderStatus.CLOSED, closedAt: new Date() },
      });
    });
    return this.get(id);
  }

  /**
   * Recepción (parcial o total) en una sola transacción: valida cantidades
   * pendientes y vencimientos, crea o incrementa los lotes, registra las
   * entradas de inventario y actualiza la orden. Cualquier error revierte todo.
   */
  async receive(
    actor: AuthUser,
    id: string,
    dto: ReceiptInputDto,
  ): Promise<PurchaseOrderDetailDto> {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, id);
      if (!RECEIVABLE.has(order.status)) {
        throw new ConflictException(
          'La orden debe estar aprobada para recibir mercadería',
        );
      }
      const items = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: id },
        include: {
          product: {
            include: { _count: { select: { activeIngredients: true } } },
          },
        },
      });
      const byId = new Map(items.map((i) => [i.id, i]));

      // Total recibido por línea en esta recepción (puede venir en varios lotes).
      const incoming = new Map<string, number>();
      for (const line of dto.items) {
        const item = byId.get(line.purchaseOrderItemId);
        if (!item)
          throw new BadRequestException('Una línea no pertenece a esta orden');
        incoming.set(item.id, (incoming.get(item.id) ?? 0) + line.quantity);
      }
      for (const [itemId, quantity] of incoming) {
        const item = byId.get(itemId)!;
        const pending = item.quantityOrdered - item.quantityReceived;
        if (quantity > pending) {
          throw new BadRequestException(
            `${item.product.name}: se reciben ${quantity} y solo hay ${pending} pendiente(s)`,
          );
        }
      }

      const receipt = await tx.purchaseReceipt.create({
        data: {
          purchaseOrderId: id,
          supplierInvoiceNumber: dto.supplierInvoiceNumber,
          notes: dto.notes,
          receivedById: actor.id,
        },
      });

      for (const line of dto.items) {
        const item = byId.get(line.purchaseOrderItemId)!;
        const initialStatus = line.initialStatus ?? LotStatus.AVAILABLE;
        const lot = await this.lotForReceipt(
          tx,
          item.productId,
          line,
          initialStatus,
          {
            isMedicine: item.product._count.activeIngredients > 0,
          },
        );
        const unitCost = line.unitCost ?? item.unitCost.toFixed(4);
        const movement = await this.ledger.apply(tx, {
          lotId: lot.id,
          type: MovementType.PURCHASE_RECEIPT,
          quantity: line.quantity,
          unitCost,
          referenceType: 'PURCHASE_RECEIPT',
          referenceId: receipt.id,
          userId: actor.id,
        });
        await tx.purchaseReceiptItem.create({
          data: {
            receiptId: receipt.id,
            purchaseOrderItemId: item.id,
            lotId: lot.id,
            movementId: movement.id,
            quantity: line.quantity,
            unitCost,
            initialStatus,
          },
        });
      }

      for (const [itemId, quantity] of incoming) {
        await tx.purchaseOrderItem.update({
          where: { id: itemId },
          data: { quantityReceived: { increment: quantity } },
        });
      }
      const remaining = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: id },
        select: { quantityOrdered: true, quantityReceived: true },
      });
      const complete = remaining.every(
        (i) => i.quantityReceived >= i.quantityOrdered,
      );
      await tx.purchaseOrder.update({
        where: { id },
        data: complete
          ? { status: PurchaseOrderStatus.RECEIVED, closedAt: new Date() }
          : { status: PurchaseOrderStatus.PARTIALLY_RECEIVED },
      });
    });
    return this.get(id);
  }

  // ─── Internos ──────────────────────────────────────────────────────────────

  /**
   * Lote de destino: si el número de lote ya existe para el producto, se suma
   * a él (debe coincidir el vencimiento y el estado); si no, se crea.
   */
  private async lotForReceipt(
    tx: Tx,
    productId: string,
    line: ReceiptInputDto['items'][number],
    status: LotStatus,
    { isMedicine }: { isMedicine: boolean },
  ) {
    const existing = await tx.lot.findUnique({
      where: { productId_lotNumber: { productId, lotNumber: line.lotNumber } },
    });
    if (!existing) {
      return this.lots.createLot(tx, {
        productId,
        lotNumber: line.lotNumber,
        expirationDate: line.expirationDate,
        manufacturingDate: line.manufacturingDate,
        status,
      });
    }
    await this.lots.assertExpiration(line, isMedicine);
    if (
      formatDateOnly(existing.expirationDate) !== (line.expirationDate ?? null)
    ) {
      throw new BadRequestException(
        `El lote ${line.lotNumber} ya existe con vencimiento ${
          formatDateOnly(existing.expirationDate) ?? 'sin fecha'
        }; verifique el número de lote o la fecha`,
      );
    }
    if (existing.status !== status) {
      throw new BadRequestException(
        `El lote ${line.lotNumber} ya existe en estado ${existing.status}; recíbalo con el mismo estado`,
      );
    }
    return existing;
  }

  private async replaceItems(
    tx: Tx,
    orderId: string,
    items: PurchaseOrderInputDto['items'],
  ): Promise<void> {
    const productIds = items.map((i) => i.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException(
        'Cada producto debe aparecer una sola vez en la orden',
      );
    }
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, deletedAt: null },
      include: { taxRate: true },
    });
    if (products.length !== productIds.length) {
      throw new NotFoundException('Uno o más productos no existen');
    }
    const byId = new Map(products.map((p) => [p.id, p]));

    let subtotal = new Decimal(0);
    let taxTotal = new Decimal(0);
    const rows = items.map((item) => {
      const taxRate = byId.get(item.productId)!.taxRate.rate;
      const lineSubtotal = roundMoney(
        new Decimal(item.unitCost).mul(item.quantity),
      );
      const lineTax = roundMoney(lineSubtotal.mul(taxRate));
      subtotal = subtotal.add(lineSubtotal);
      taxTotal = taxTotal.add(lineTax);
      return {
        purchaseOrderId: orderId,
        productId: item.productId,
        quantityOrdered: item.quantity,
        unitCost: item.unitCost,
        taxRate,
        lineSubtotal,
        lineTax,
        lineTotal: lineSubtotal.add(lineTax),
      };
    });
    await tx.purchaseOrderItem.deleteMany({
      where: { purchaseOrderId: orderId },
    });
    await tx.purchaseOrderItem.createMany({ data: rows });
    await tx.purchaseOrder.update({
      where: { id: orderId },
      data: { subtotal, taxTotal, total: subtotal.add(taxTotal) },
    });
  }

  /** Bloquea la orden para serializar aprobaciones, recepciones y cierres. */
  private async lockOrder(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT 1 FROM purchase_orders WHERE id = ${id}::uuid FOR UPDATE`;
    const order = await tx.purchaseOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Orden de compra no encontrada');
    return order;
  }

  private async assertSupplier(id: string): Promise<void> {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, deletedAt: null, isActive: true },
    });
    if (!supplier)
      throw new NotFoundException('El proveedor no existe o está inactivo');
  }

  private async toDetail(order: DetailRow): Promise<PurchaseOrderDetailDto> {
    const userIds = [
      order.createdById,
      order.approvedById,
      ...order.receipts.map((r) => r.receivedById),
    ].filter((u): u is string => Boolean(u));
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      ...person,
    });
    const name = (id: string | null) => {
      const user = users.find((u) => u.id === id);
      return user
        ? { id: user.id, name: `${user.firstName} ${user.lastName}` }
        : null;
    };
    return {
      // toSummary devuelve un objeto plano; el tipo es una clase solo por Swagger.
      // oxlint-disable-next-line typescript/no-misused-spread
      ...toSummary(order),
      notes: order.notes,
      createdBy: name(order.createdById)!,
      approvedBy: name(order.approvedById),
      approvedAt: order.approvedAt?.toISOString() ?? null,
      closedAt: order.closedAt?.toISOString() ?? null,
      items: order.items.map((i) => ({
        id: i.id,
        product: i.product,
        quantityOrdered: i.quantityOrdered,
        quantityReceived: i.quantityReceived,
        quantityPending: i.quantityOrdered - i.quantityReceived,
        unitCost: i.unitCost.toFixed(4),
        taxRate: i.taxRate.toFixed(4),
        lineSubtotal: i.lineSubtotal.toFixed(2),
        lineTax: i.lineTax.toFixed(2),
        lineTotal: i.lineTotal.toFixed(2),
      })),
      receipts: order.receipts.map((r) => ({
        id: r.id,
        number: r.number,
        supplierInvoiceNumber: r.supplierInvoiceNumber,
        notes: r.notes,
        receivedBy: name(r.receivedById)!,
        receivedAt: r.receivedAt.toISOString(),
        items: r.items.map((i) => ({
          id: i.id,
          purchaseOrderItemId: i.purchaseOrderItemId,
          product: i.purchaseOrderItem.product,
          lot: {
            id: i.lot.id,
            lotNumber: i.lot.lotNumber,
            expirationDate: formatDateOnly(i.lot.expirationDate),
          },
          quantity: i.quantity,
          unitCost: i.unitCost.toFixed(4),
          initialStatus: i.initialStatus,
        })),
      })),
    };
  }
}

function toSummary(order: SummaryRow): PurchaseOrderSummaryDto {
  return {
    id: order.id,
    number: order.number,
    supplier: order.supplier,
    status: order.status,
    orderDate: formatDateOnly(order.orderDate)!,
    expectedDate: formatDateOnly(order.expectedDate),
    subtotal: order.subtotal.toFixed(2),
    taxTotal: order.taxTotal.toFixed(2),
    total: order.total.toFixed(2),
    createdAt: order.createdAt.toISOString(),
  };
}
