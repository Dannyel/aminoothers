import { Prisma } from '../../generated/prisma/client.js';

export type DecimalValue = Prisma.Decimal;
/** Valores que acepta el constructor de Decimal. */
export type DecimalInput = Prisma.Decimal | string | number;
export const Decimal = Prisma.Decimal;

/** Redondeo comercial a 2 decimales (mitad hacia arriba). */
export function roundMoney(value: DecimalInput): Prisma.Decimal {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Costo promedio ponderado tras una entrada:
 * (existencia × costo actual + cantidad × costo de entrada) / existencia nueva.
 */
export function weightedAverageCost(
  currentQty: number,
  currentCost: DecimalInput,
  incomingQty: number,
  incomingCost: DecimalInput,
): Prisma.Decimal {
  const totalQty = currentQty + incomingQty;
  if (totalQty <= 0) return new Decimal(incomingCost);
  return new Decimal(currentCost)
    .mul(currentQty)
    .add(new Decimal(incomingCost).mul(incomingQty))
    .div(totalQty)
    .toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}
