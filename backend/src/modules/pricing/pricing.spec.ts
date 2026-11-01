import { includedTax, orderTotals, priceLine } from './pricing.js';

describe('pricing', () => {
  it('desglosa el IVA incluido en el precio', () => {
    expect(includedTax('112.00', '0.12').toFixed(2)).toBe('12.00');
    expect(includedTax('30.00', '0.12').toFixed(2)).toBe('3.21');
    expect(includedTax('30.00', '0').toFixed(2)).toBe('0.00');
  });

  it('calcula la línea con su impuesto, por línea y no por unidad', () => {
    const line = priceLine({
      unitPrice: '30.00',
      taxRate: '0.12',
      quantity: 3,
    });
    expect(line.lineSubtotal.toFixed(2)).toBe('90.00');
    expect(line.lineDiscount.toFixed(2)).toBe('0.00');
    expect(line.lineTotal.toFixed(2)).toBe('90.00');
    // 90 − 90 / 1.12 = 9.642… → 9.64 (3 × 3.21 daría 9.63).
    expect(line.lineTax.toFixed(2)).toBe('9.64');
  });

  it('aplica el descuento unitario y lo rechaza si supera el precio', () => {
    const line = priceLine({
      unitPrice: '50',
      taxRate: '0.12',
      quantity: 2,
      unitDiscount: '5',
    });
    expect(line.lineTotal.toFixed(2)).toBe('90.00');
    expect(() =>
      priceLine({
        unitPrice: '5',
        taxRate: '0.12',
        quantity: 1,
        unitDiscount: '6',
      }),
    ).toThrow();
    expect(() =>
      priceLine({ unitPrice: '5', taxRate: '0.12', quantity: 0 }),
    ).toThrow();
  });

  it('suma líneas y envío; el total incluye el envío con su IVA', () => {
    const lines = [
      priceLine({ unitPrice: '30.00', taxRate: '0.12', quantity: 3 }),
      priceLine({ unitPrice: '8.50', taxRate: '0', quantity: 2 }),
    ];
    const totals = orderTotals(lines, { cost: '25.00', taxRate: '0.12' });
    expect(totals.subtotal.toFixed(2)).toBe('107.00');
    expect(totals.shippingCost.toFixed(2)).toBe('25.00');
    expect(totals.shippingTax.toFixed(2)).toBe('2.68');
    expect(totals.taxTotal.toFixed(2)).toBe('12.32');
    expect(totals.total.toFixed(2)).toBe('132.00');
  });

  it('sin envío elegido el envío vale cero', () => {
    const totals = orderTotals([
      priceLine({ unitPrice: '10', taxRate: '0.12', quantity: 1 }),
    ]);
    expect(totals.shippingCost.toFixed(2)).toBe('0.00');
    expect(totals.total.toFixed(2)).toBe('10.00');
  });
});
