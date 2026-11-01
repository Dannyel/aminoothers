import { Decimal } from '../../common/utils/money.js';
import { diff, REDACTED, sanitize } from './audit-trail.js';
import { moduleOf } from './audit.interceptor.js';

describe('auditoría', () => {
  it('oculta contraseñas, tokens y códigos sin importar la profundidad', () => {
    expect(
      sanitize({
        name: 'Ana',
        password: 'secreta',
        nested: { refreshToken: 'abc', totpCode: '123456', code: 'IVA' },
        list: [{ newPassword: 'x' }],
      }),
    ).toEqual({
      name: 'Ana',
      password: REDACTED,
      nested: { refreshToken: REDACTED, totpCode: REDACTED, code: 'IVA' },
      list: [{ newPassword: REDACTED }],
    });
  });

  it('guarda Decimal y fechas como texto y acota los textos largos', () => {
    const result = sanitize({
      price: new Decimal('12.50'),
      at: new Date('2026-11-01T10:00:00.000Z'),
      notes: 'x'.repeat(1500),
    }) as Record<string, string>;
    expect(result.price).toBe('12.5');
    expect(result.at).toBe('2026-11-01T10:00:00.000Z');
    expect(result.notes).toHaveLength(1001);
  });

  it('el diff deja solo los campos que cambiaron', () => {
    expect(
      diff(
        {
          price: new Decimal('10.00'),
          name: 'A',
          isActive: true,
          updatedAt: new Date(1),
        },
        {
          price: new Decimal('12.00'),
          name: 'A',
          isActive: false,
          updatedAt: new Date(2),
        },
      ),
    ).toEqual({
      before: { price: '10', isActive: true },
      after: { price: '12', isActive: false },
    });
  });

  it('deduce el módulo de la ruta', () => {
    expect(moduleOf('/admin/products/:id')).toBe('products');
    expect(moduleOf('/admin/billing/invoices/:id/fel')).toBe('billing');
    expect(moduleOf('/admin')).toBe('admin');
    expect(moduleOf('/auth/login')).toBe('auth');
  });
});
