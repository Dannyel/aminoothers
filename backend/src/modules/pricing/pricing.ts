import {
  Decimal,
  roundMoney,
  type DecimalInput,
  type DecimalValue,
} from '../../common/utils/money.js';

/**
 * Cálculo único de importes de la tienda (carrito y checkout). Los precios
 * incluyen IVA (D1): el impuesto se desglosa del total de cada línea. El
 * frontend nunca envía importes; solo compara el total para detectar cambios.
 */
export interface LineInput {
  /** Precio normal unitario con IVA incluido. */
  unitPrice: DecimalInput;
  /** Proporción: 0.12 = 12 %. */
  taxRate: DecimalInput;
  quantity: number;
  /** Descuento unitario (promociones, Fase 8). */
  unitDiscount?: DecimalInput;
}

export interface PricedLine {
  unitPrice: DecimalValue;
  unitDiscount: DecimalValue;
  taxRate: DecimalValue;
  quantity: number;
  lineSubtotal: DecimalValue;
  lineDiscount: DecimalValue;
  lineTotal: DecimalValue;
  lineTax: DecimalValue;
}

export interface OrderTotals {
  subtotal: DecimalValue;
  discountTotal: DecimalValue;
  shippingCost: DecimalValue;
  shippingTax: DecimalValue;
  /** IVA contenido en las líneas y en el envío. */
  taxTotal: DecimalValue;
  total: DecimalValue;
}

/** IVA contenido en un importe que ya lo incluye: importe − importe / (1 + tasa). */
export function includedTax(
  amount: DecimalInput,
  rate: DecimalInput,
): DecimalValue {
  const gross = new Decimal(amount);
  return roundMoney(gross.sub(gross.div(new Decimal(rate).add(1))));
}

export function priceLine(input: LineInput): PricedLine {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error('La cantidad debe ser un entero positivo');
  }
  const unitPrice = roundMoney(input.unitPrice);
  const unitDiscount = roundMoney(input.unitDiscount ?? 0);
  if (unitDiscount.isNegative() || unitDiscount.greaterThan(unitPrice)) {
    throw new Error('El descuento no puede superar el precio');
  }
  const taxRate = new Decimal(input.taxRate);
  const lineSubtotal = unitPrice.mul(input.quantity);
  const lineDiscount = unitDiscount.mul(input.quantity);
  const lineTotal = lineSubtotal.sub(lineDiscount);
  return {
    unitPrice,
    unitDiscount,
    taxRate,
    quantity: input.quantity,
    lineSubtotal,
    lineDiscount,
    lineTotal,
    lineTax: includedTax(lineTotal, taxRate),
  };
}

/** Totales del pedido. Sin método de envío elegido, el envío vale 0. */
export function orderTotals(
  lines: readonly PricedLine[],
  shipping?: { cost: DecimalInput; taxRate: DecimalInput },
): OrderTotals {
  const sum = (pick: (l: PricedLine) => DecimalValue) =>
    lines.reduce((acc, l) => acc.add(pick(l)), new Decimal(0));
  const subtotal = sum((l) => l.lineSubtotal);
  const discountTotal = sum((l) => l.lineDiscount);
  const shippingCost = roundMoney(shipping?.cost ?? 0);
  const shippingTax = shipping
    ? includedTax(shippingCost, shipping.taxRate)
    : new Decimal(0);
  return {
    subtotal,
    discountTotal,
    shippingCost,
    shippingTax,
    taxTotal: sum((l) => l.lineTax).add(shippingTax),
    total: subtotal.sub(discountTotal).add(shippingCost),
  };
}
