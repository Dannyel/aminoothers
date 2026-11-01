import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { addDays, todayInBusinessZone } from '../../common/utils/dates.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  LotStatus,
  MovementType,
  OrderStatus,
  ReservationStatus,
  ReturnDisposition,
  ReturnStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StockLedgerService } from '../inventory/stock-ledger.service.js';
import type { ReturnDto, ReturnPageDto } from './dto/orders.dto.js';
import type {
  CreateReturnDto,
  InspectReturnItemDto,
  ReturnsQueryDto,
} from './dto/sales.dto.js';
import { assertStatus, lockOrder } from './order-status.js';
import { OrdersService, returnInclude, toReturnDto } from './orders.service.js';

type Tx = Prisma.TransactionClient;
const TX_OPTIONS = { maxWait: 5_000, timeout: 15_000 };

/** Unidades por devolver de una línea: cantidad y lote de origen. */
interface ReturnChunk {
  orderItemId: string;
  lotId: string;
  quantity: number;
}

/**
 * Devoluciones registradas por el personal (D7). Las unidades devueltas nunca
 * vuelven solas al inventario: quedan pendientes de inspección y solo la
 * disposición RESTOCK las reincorpora a su lote original.
 */
@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedgerService,
    private readonly orders: OrdersService,
  ) {}

  async list(query: ReturnsQueryDto): Promise<ReturnPageDto> {
    const where: Prisma.ReturnWhereInput = query.status
      ? { status: query.status }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.return.findMany({
        where,
        include: returnInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.return.count({ where }),
    ]);
    const names = await this.namesFor(rows);
    return {
      items: rows.map((r) => toReturnDto(r, names)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<ReturnDto> {
    const row = await this.prisma.return.findUnique({
      where: { id },
      include: returnInclude,
    });
    if (!row) throw new NotFoundException('Devolución no encontrada');
    return toReturnDto(row, await this.namesFor([row]));
  }

  /** Solo pedidos entregados y dentro del plazo de devolución. */
  async create(
    actorId: string,
    orderId: string,
    dto: CreateReturnDto,
  ): Promise<ReturnDto> {
    const id = await this.prisma.$transaction(async (tx) => {
      const order = await lockOrder(tx, orderId);
      assertStatus(order, [OrderStatus.DELIVERED], 'registrar una devolución');
      await this.assertWithinWindow(tx, orderId);

      const merged = new Map<string, number>();
      for (const line of dto.items) {
        merged.set(
          line.orderItemId,
          (merged.get(line.orderItemId) ?? 0) + line.quantity,
        );
      }
      const chunks: ReturnChunk[] = [];
      for (const [orderItemId, quantity] of merged) {
        chunks.push(
          ...(await this.allocate(tx, orderId, orderItemId, quantity)),
        );
      }
      const created = await tx.return.create({
        data: {
          orderId,
          reason: dto.reason,
          notes: dto.notes ?? null,
          createdById: actorId,
          items: { create: chunks },
        },
      });
      return created.id;
    }, TX_OPTIONS);
    return this.get(id);
  }

  /**
   * Paquete devuelto por la mensajería: devolución ya recibida con todas las
   * unidades que aún no estaban en otra devolución.
   */
  async createReceivedForWholeOrder(
    tx: Tx,
    orderId: string,
    actorId: string,
    reason: string,
  ): Promise<void> {
    const items = await tx.orderItem.findMany({ where: { orderId } });
    const chunks: ReturnChunk[] = [];
    for (const item of items) {
      const pending = item.quantity - item.quantityReturned;
      if (pending > 0)
        chunks.push(...(await this.allocate(tx, orderId, item.id, pending)));
    }
    if (chunks.length === 0) return;
    const now = new Date();
    await tx.return.create({
      data: {
        orderId,
        status: ReturnStatus.RECEIVED,
        reason: `La mensajería devolvió el paquete: ${reason}`.slice(0, 500),
        createdById: actorId,
        decidedById: actorId,
        decidedAt: now,
        receivedById: actorId,
        receivedAt: now,
        items: { create: chunks },
      },
    });
  }

  approve(actorId: string, id: string): Promise<ReturnDto> {
    return this.change(id, [ReturnStatus.REQUESTED], 'aprobar', (tx) =>
      tx.return.update({
        where: { id },
        data: {
          status: ReturnStatus.APPROVED,
          decidedById: actorId,
          decidedAt: new Date(),
        },
      }),
    );
  }

  /** Rechazar libera las unidades para otra devolución. */
  reject(actorId: string, id: string, reason: string): Promise<ReturnDto> {
    return this.change(
      id,
      [ReturnStatus.REQUESTED, ReturnStatus.APPROVED],
      'rechazar',
      async (tx) => {
        const items = await tx.returnItem.findMany({ where: { returnId: id } });
        for (const item of items) {
          await tx.orderItem.update({
            where: { id: item.orderItemId },
            data: { quantityReturned: { decrement: item.quantity } },
          });
        }
        await tx.return.update({
          where: { id },
          data: {
            status: ReturnStatus.REJECTED,
            rejectedReason: reason,
            decidedById: actorId,
            decidedAt: new Date(),
          },
        });
      },
    );
  }

  /** Las unidades llegaron a la farmacia: quedan pendientes de inspección. */
  receive(actorId: string, id: string): Promise<ReturnDto> {
    return this.change(id, [ReturnStatus.APPROVED], 'recibir', (tx) =>
      tx.return.update({
        where: { id },
        data: {
          status: ReturnStatus.RECEIVED,
          receivedById: actorId,
          receivedAt: new Date(),
        },
      }),
    );
  }

  /**
   * Inspección de una línea. RESTOCK reincorpora las unidades a su lote solo si
   * el lote sigue disponible y vigente; si no, deben destruirse o devolverse al
   * proveedor. Con todas las líneas inspeccionadas la devolución se cierra.
   */
  inspect(
    actorId: string,
    id: string,
    itemId: string,
    dto: InspectReturnItemDto,
  ): Promise<ReturnDto> {
    return this.change(
      id,
      [ReturnStatus.RECEIVED],
      'inspeccionar',
      async (tx) => {
        const item = await tx.returnItem.findFirst({
          where: { id: itemId, returnId: id },
          include: { lot: true },
        });
        if (!item)
          throw new NotFoundException('Línea de devolución no encontrada');
        if (item.disposition !== ReturnDisposition.PENDING_INSPECTION) {
          throw new ConflictException('Esta línea ya fue inspeccionada');
        }
        let movementId: string | null = null;
        if (dto.disposition === ReturnDisposition.RESTOCK) {
          const today = todayInBusinessZone();
          const expired =
            item.lot.expirationDate !== null &&
            item.lot.expirationDate.toISOString().slice(0, 10) < today;
          if (item.lot.status !== LotStatus.AVAILABLE || expired) {
            throw new BadRequestException(
              `El lote ${item.lot.lotNumber} no está disponible o venció: elija destruir o devolver al proveedor`,
            );
          }
          const movement = await this.ledger.apply(tx, {
            lotId: item.lotId,
            type: MovementType.RETURN_RESTOCK,
            quantity: item.quantity,
            referenceType: 'RETURN',
            referenceId: id,
            notes: dto.conditionNotes ?? undefined,
            userId: actorId,
          });
          movementId = movement.id;
        }
        await tx.returnItem.update({
          where: { id: itemId },
          data: {
            disposition: dto.disposition,
            conditionNotes: dto.conditionNotes ?? null,
            inspectedById: actorId,
            inspectedAt: new Date(),
            movementId,
          },
        });
        const pending = await tx.returnItem.count({
          where: {
            returnId: id,
            disposition: ReturnDisposition.PENDING_INSPECTION,
          },
        });
        if (pending === 0) {
          await tx.return.update({
            where: { id },
            data: { status: ReturnStatus.CLOSED, closedAt: new Date() },
          });
        }
      },
    );
  }

  // ─── Internos ──────────────────────────────────────────────────────────────

  private async change(
    id: string,
    allowed: readonly ReturnStatus[],
    action: string,
    apply: (tx: Tx) => Promise<unknown>,
  ): Promise<ReturnDto> {
    await this.prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<Array<{ status: ReturnStatus }>>`
        SELECT status FROM returns WHERE id = ${id}::uuid FOR UPDATE`;
      if (!row) throw new NotFoundException('Devolución no encontrada');
      if (!allowed.includes(row.status)) {
        throw new ConflictException(
          `No se puede ${action} una devolución en estado ${row.status}`,
        );
      }
      await apply(tx);
    }, TX_OPTIONS);
    return this.get(id);
  }

  private async assertWithinWindow(tx: Tx, orderId: string): Promise<void> {
    // Consultas en serie: una transacción usa una sola conexión.
    const shipment = await tx.shipment.findUnique({ where: { orderId } });
    const settings = await tx.storeSettings.findUniqueOrThrow({
      where: { id: 1 },
    });
    if (!shipment?.deliveredAt) {
      throw new ConflictException('El pedido no tiene entrega registrada');
    }
    const deadline = addDays(
      todayInBusinessZone(shipment.deliveredAt),
      settings.returnWindowDays,
    );
    if (todayInBusinessZone() > deadline) {
      throw new ConflictException(
        `Venció el plazo de ${settings.returnWindowDays} días para registrar devoluciones (hasta el ${deadline})`,
      );
    }
  }

  /**
   * Reparte las unidades devueltas entre los lotes de los que salieron
   * (reservas consumidas), sin superar lo que ya se devolvió de cada lote.
   * Aumenta `quantity_returned` de la línea.
   */
  private async allocate(
    tx: Tx,
    orderId: string,
    orderItemId: string,
    quantity: number,
  ): Promise<ReturnChunk[]> {
    const item = await tx.orderItem.findFirst({
      where: { id: orderItemId, orderId },
      include: {
        reservations: {
          where: { status: ReservationStatus.CONSUMED },
          orderBy: { createdAt: 'asc' },
        },
        returnItems: {
          where: { return: { status: { not: ReturnStatus.REJECTED } } },
        },
      },
    });
    if (!item) throw new NotFoundException('La línea no pertenece al pedido');
    const available = item.quantity - item.quantityReturned;
    if (quantity > available) {
      throw new BadRequestException(
        `De «${item.productName}» se pueden devolver hasta ${available} unidad(es)`,
      );
    }
    const chunks: ReturnChunk[] = [];
    let pending = quantity;
    for (const reservation of item.reservations) {
      if (pending === 0) break;
      const alreadyReturned = item.returnItems
        .filter((r) => r.lotId === reservation.lotId)
        .reduce((n, r) => n + r.quantity, 0);
      const free = reservation.quantity - alreadyReturned;
      const take = Math.min(free, pending);
      if (take > 0) {
        chunks.push({ orderItemId, lotId: reservation.lotId, quantity: take });
        pending -= take;
      }
    }
    if (pending > 0) {
      throw new ConflictException(
        `No se encontró el lote de origen de «${item.productName}»`,
      );
    }
    await tx.orderItem.update({
      where: { id: orderItemId },
      data: { quantityReturned: { increment: quantity } },
    });
    return chunks;
  }

  private namesFor(
    rows: Array<{
      createdById: string;
      items: Array<{ inspectedById: string | null }>;
      refunds: Array<{ processedById: string | null }>;
    }>,
  ) {
    return this.orders.staffNames(
      rows.flatMap((r) => [
        r.createdById,
        ...r.items.map((i) => i.inspectedById),
        ...r.refunds.map((f) => f.processedById),
      ]),
    );
  }
}
