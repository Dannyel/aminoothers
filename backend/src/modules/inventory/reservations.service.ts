import { Injectable } from '@nestjs/common';
import { formatDateOnly } from '../../common/utils/dates.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  MovementType,
  ReservationStatus,
} from '../../generated/prisma/enums.js';
import { allocateFefo, type FefoAllocation } from './fefo.js';
import type { ExpiryWindow } from './inventory-settings.service.js';
import { StockLedgerService } from './stock-ledger.service.js';
import { sellable } from './stock.service.js';

type Tx = Prisma.TransactionClient;

export type ReserveResult =
  | { ok: true; allocations: FefoAllocation[] }
  | { ok: false; available: number };

/**
 * Reservas de existencia por línea de pedido. Es el único punto que cambia
 * `lots.qty_reserved`. Para evitar interbloqueos, los lotes siempre se
 * bloquean en el mismo orden: producto y luego FEFO.
 */
@Injectable()
export class ReservationsService {
  constructor(private readonly ledger: StockLedgerService) {}

  /**
   * Reserva `quantity` unidades del producto en sus lotes vendibles por FEFO.
   * Quien llama procesa los productos en orden de id dentro de su transacción.
   * Si no alcanza, no reserva nada y devuelve lo disponible.
   */
  async reserve(
    tx: Tx,
    orderItemId: string,
    productId: string,
    quantity: number,
    window: ExpiryWindow,
  ): Promise<ReserveResult> {
    const lots = await tx.$queryRaw<
      Array<{
        id: string;
        expiration_date: Date | null;
        first_received_at: Date;
        available: number;
      }>
    >`
      SELECT id, expiration_date, first_received_at, qty_on_hand - qty_reserved AS available
      FROM lots
      WHERE product_id = ${productId}::uuid AND ${sellable(window)} AND qty_on_hand > qty_reserved
      ORDER BY expiration_date ASC NULLS LAST, first_received_at, id
      FOR UPDATE`;

    const allocations = allocateFefo(
      lots.map((l) => ({
        id: l.id,
        expirationDate: formatDateOnly(l.expiration_date),
        firstReceivedAt: l.first_received_at,
        available: l.available,
      })),
      quantity,
    );
    if (!allocations) {
      return {
        ok: false,
        available: lots.reduce((sum, l) => sum + l.available, 0),
      };
    }
    for (const a of allocations) {
      await tx.lot.update({
        where: { id: a.lotId },
        data: { qtyReserved: { increment: a.quantity } },
      });
    }
    await tx.stockReservation.createMany({
      data: allocations.map((a) => ({
        orderItemId,
        lotId: a.lotId,
        quantity: a.quantity,
      })),
    });
    return { ok: true, allocations };
  }

  /**
   * Descuenta del inventario las reservas activas del pedido al despacharlo:
   * un movimiento SALE por lote, que resta la existencia física y la
   * reservada. La reserva queda CONSUMED con su movimiento (trazabilidad
   * pedido → línea → lote → movimiento).
   */
  async consumeForOrder(
    tx: Tx,
    orderId: string,
    userId: string,
  ): Promise<void> {
    const active = await tx.stockReservation.findMany({
      where: { status: ReservationStatus.ACTIVE, orderItem: { orderId } },
      select: { id: true, lotId: true, quantity: true },
    });
    await this.lockLots(
      tx,
      active.map((r) => r.lotId),
    );
    for (const r of active) {
      const movement = await this.ledger.apply(tx, {
        lotId: r.lotId,
        type: MovementType.SALE,
        quantity: -r.quantity,
        consumesReserved: r.quantity,
        referenceType: 'ORDER',
        referenceId: orderId,
        userId,
      });
      await tx.stockReservation.update({
        where: { id: r.id },
        data: {
          status: ReservationStatus.CONSUMED,
          consumedMovementId: movement.id,
        },
      });
    }
  }

  /**
   * Libera las reservas activas del pedido (cancelación o vencimiento). Las
   * unidades vuelven a estar disponibles en sus mismos lotes.
   */
  async releaseForOrder(
    tx: Tx,
    orderId: string,
    status:
      typeof ReservationStatus.RELEASED | typeof ReservationStatus.EXPIRED,
  ): Promise<void> {
    const active = await tx.stockReservation.findMany({
      where: { status: ReservationStatus.ACTIVE, orderItem: { orderId } },
      select: { id: true, lotId: true, quantity: true },
    });
    if (active.length === 0) return;

    await this.lockLots(
      tx,
      active.map((r) => r.lotId),
    );
    for (const r of active) {
      await tx.lot.update({
        where: { id: r.lotId },
        data: { qtyReserved: { decrement: r.quantity } },
      });
    }
    await tx.stockReservation.updateMany({
      where: { id: { in: active.map((r) => r.id) } },
      data: { status },
    });
  }

  /** Bloquea los lotes en el orden global (producto y FEFO) para no interbloquear. */
  private async lockLots(tx: Tx, ids: string[]): Promise<void> {
    const lotIds = [...new Set(ids)];
    if (lotIds.length === 0) return;
    await tx.$queryRaw`
      SELECT id FROM lots
      WHERE id IN (${Prisma.join(lotIds.map((id) => Prisma.sql`${id}::uuid`))})
      ORDER BY product_id, expiration_date ASC NULLS LAST, first_received_at, id
      FOR UPDATE`;
  }
}
