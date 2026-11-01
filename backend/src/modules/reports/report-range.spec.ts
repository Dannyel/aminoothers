import { BadRequestException } from '@nestjs/common';
import { daysBetween, reportWindow } from './report-range.js';
import { totalsOf } from './reports.service.js';

describe('rango de reportes', () => {
  it('lista los días con ambos extremos, cruzando meses', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
    expect(daysBetween('2026-11-01', '2026-11-01')).toEqual(['2026-11-01']);
  });

  it('convierte el rango a instantes de Guatemala (UTC−6)', () => {
    const { start, end } = reportWindow('2026-11-01', '2026-11-01');
    expect(start.toISOString()).toBe('2026-11-01T06:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-02T06:00:00.000Z');
  });

  it('rechaza rangos invertidos o de más de 366 días', () => {
    expect(() => reportWindow('2026-11-02', '2026-11-01')).toThrow(
      BadRequestException,
    );
    expect(() => reportWindow('2025-01-01', '2026-01-02')).toThrow(
      BadRequestException,
    );
    expect(() => reportWindow('2025-01-01', '2026-01-01')).not.toThrow();
  });

  it('suma las ventas y calcula el ticket promedio', () => {
    const row = (total: string, orders: number) => ({
      date: '2026-11-01',
      orders,
      units: orders * 2,
      subtotal: total,
      discount: '0',
      shipping: '0',
      tax: '0',
      total,
    });
    expect(totalsOf([row('100.00', 2), undefined, row('50.50', 1)])).toEqual(
      expect.objectContaining({
        orders: 3,
        units: 6,
        total: '150.50',
        averageTicket: '50.17',
      }),
    );
    expect(totalsOf([]).averageTicket).toBe('0.00');
  });
});
