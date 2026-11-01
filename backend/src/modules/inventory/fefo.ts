/**
 * FEFO (First Expired, First Out): las unidades se toman de los lotes que
 * vencen antes. Los lotes sin vencimiento van al final; a igual vencimiento,
 * primero el más antiguo. Es una función pura: la consulta de lotes elegibles
 * y los bloqueos los hace quien la usa (reservas de la Fase 6).
 */
export interface FefoLot {
  id: string;
  /** AAAA-MM-DD o null si el producto no vence. */
  expirationDate: string | null;
  firstReceivedAt: Date;
  available: number;
}

export interface FefoAllocation {
  lotId: string;
  quantity: number;
}

export function sortFefo<T extends FefoLot>(lots: readonly T[]): T[] {
  return [...lots].sort((a, b) => {
    if (a.expirationDate !== b.expirationDate) {
      if (a.expirationDate === null) return 1;
      if (b.expirationDate === null) return -1;
      return a.expirationDate < b.expirationDate ? -1 : 1;
    }
    const byAge = a.firstReceivedAt.getTime() - b.firstReceivedAt.getTime();
    return byAge !== 0 ? byAge : a.id.localeCompare(b.id);
  });
}

/**
 * Reparte `quantity` entre los lotes en orden FEFO. Devuelve null si no hay
 * suficiente disponible (nunca asigna parcialmente).
 */
export function allocateFefo(
  lots: readonly FefoLot[],
  quantity: number,
): FefoAllocation[] | null {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('La cantidad debe ser un entero positivo');
  }
  const allocations: FefoAllocation[] = [];
  let pending = quantity;
  for (const lot of sortFefo(lots)) {
    if (pending === 0) break;
    const take = Math.min(lot.available, pending);
    if (take <= 0) continue;
    allocations.push({ lotId: lot.id, quantity: take });
    pending -= take;
  }
  return pending === 0 ? allocations : null;
}
