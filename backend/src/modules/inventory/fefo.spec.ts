import { allocateFefo, sortFefo, type FefoLot } from './fefo.js';

const lot = (
  id: string,
  expirationDate: string | null,
  available: number,
  receivedDaysAgo = 0,
): FefoLot => ({
  id,
  expirationDate,
  available,
  firstReceivedAt: new Date(Date.UTC(2026, 0, 31 - receivedDaysAgo)),
});

describe('FEFO', () => {
  it('ordena por vencimiento, deja al final los que no vencen y desempata por antigüedad', () => {
    const sorted = sortFefo([
      lot('sin-venc', null, 5),
      lot('dic', '2027-12-01', 5),
      lot('mar-nuevo', '2027-03-01', 5, 1),
      lot('mar-viejo', '2027-03-01', 5, 10),
    ]);
    expect(sorted.map((l) => l.id)).toEqual([
      'mar-viejo',
      'mar-nuevo',
      'dic',
      'sin-venc',
    ]);
  });

  it('toma primero del lote que vence antes y reparte entre lotes', () => {
    expect(
      allocateFefo([lot('b', '2027-06-01', 10), lot('a', '2027-01-01', 3)], 8),
    ).toEqual([
      { lotId: 'a', quantity: 3 },
      { lotId: 'b', quantity: 5 },
    ]);
  });

  it('omite lotes sin disponible', () => {
    expect(
      allocateFefo([lot('a', '2027-01-01', 0), lot('b', '2027-02-01', 4)], 2),
    ).toEqual([{ lotId: 'b', quantity: 2 }]);
  });

  it('no asigna parcialmente si no alcanza', () => {
    expect(allocateFefo([lot('a', '2027-01-01', 3)], 4)).toBeNull();
  });

  it('rechaza cantidades no enteras o no positivas', () => {
    expect(() => allocateFefo([], 0)).toThrow();
    expect(() => allocateFefo([], 1.5)).toThrow();
  });
});
