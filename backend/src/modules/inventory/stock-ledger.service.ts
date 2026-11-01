import { ConflictException, Injectable } from '@nestjs/common';
import {
  weightedAverageCost,
  type DecimalInput,
} from '../../common/utils/money.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { MovementType } from '../../generated/prisma/enums.js';

type Tx = Prisma.TransactionClient;

export interface MovementInput {
  lotId: string;
  type: MovementType;
  /** Con signo: positivo entra, negativo sale. */
  quantity: number;
  /** Costo de la entrada; en salidas se usa el costo promedio del lote. */
  unitCost?: DecimalInput;
  reasonCode?: string;
  notes?: string;
  referenceType?: string;
  referenceId?: string;
  userId: string;
  /**
   * Unidades reservadas que esta salida consume (venta despachada): se
   * descuentan de `qty_reserved` en la misma escritura.
   */
  consumesReserved?: number;
}

const INCOMING: ReadonlySet<MovementType> = new Set([
  MovementType.PURCHASE_RECEIPT,
  MovementType.ADJUSTMENT_IN,
  MovementType.RETURN_RESTOCK,
]);

/**
 * Único punto que cambia la existencia física de un lote. Actualiza el lote y
 * registra el movimiento en la misma transacción, de modo que el saldo del
 * lote siempre es la suma de sus movimientos.
 */
@Injectable()
export class StockLedgerService {
  async apply(tx: Tx, input: MovementInput) {
    if (!Number.isInteger(input.quantity) || input.quantity === 0) {
      throw new Error(
        'La cantidad del movimiento debe ser un entero distinto de cero',
      );
    }
    if (INCOMING.has(input.type) !== input.quantity > 0) {
      throw new Error(`Signo de cantidad inválido para ${input.type}`);
    }

    // Bloquea el lote para que dos movimientos simultáneos no se pisen.
    const [lot] = await tx.$queryRaw<
      Array<{
        product_id: string;
        qty_on_hand: number;
        qty_reserved: number;
        avg_unit_cost: string;
      }>
    >`SELECT product_id, qty_on_hand, qty_reserved, avg_unit_cost
      FROM lots WHERE id = ${input.lotId}::uuid FOR UPDATE`;
    if (!lot) throw new Error(`Lote ${input.lotId} inexistente`);

    const consumed = input.consumesReserved ?? 0;
    if (
      consumed < 0 ||
      (consumed > 0 &&
        (consumed > lot.qty_reserved || consumed > -input.quantity))
    ) {
      throw new Error('Consumo de reserva inválido para el movimiento');
    }
    const reserved = lot.qty_reserved - consumed;
    const balance = lot.qty_on_hand + input.quantity;
    if (balance < reserved) {
      const free = lot.qty_on_hand - lot.qty_reserved;
      throw new ConflictException(
        `Existencia insuficiente en el lote: hay ${free} unidad(es) libre(s)${
          lot.qty_reserved > 0 ? ` y ${lot.qty_reserved} reservada(s)` : ''
        }`,
      );
    }

    const isIncoming = input.quantity > 0;
    const unitCost =
      isIncoming && input.unitCost !== undefined
        ? input.unitCost
        : lot.avg_unit_cost;
    await tx.lot.update({
      where: { id: input.lotId },
      data: {
        qtyOnHand: balance,
        ...(consumed > 0 ? { qtyReserved: reserved } : {}),
        ...(isIncoming && input.unitCost !== undefined
          ? {
              avgUnitCost: weightedAverageCost(
                lot.qty_on_hand,
                lot.avg_unit_cost,
                input.quantity,
                input.unitCost,
              ),
            }
          : {}),
      },
    });
    return tx.inventoryMovement.create({
      data: {
        lotId: input.lotId,
        productId: lot.product_id,
        type: input.type,
        quantity: input.quantity,
        balanceAfter: balance,
        unitCost,
        reasonCode: input.reasonCode,
        notes: input.notes,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        userId: input.userId,
      },
    });
  }
}
