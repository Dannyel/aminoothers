import { PromotionType } from '../../generated/prisma/enums.js';
import { bestPromotion, unitDiscount } from './promotion-pricing.js';

const at = (d: string) => new Date(`${d}T00:00:00Z`);

describe('promociones', () => {
  it('calcula el porcentaje con redondeo comercial y limita el monto fijo al precio', () => {
    expect(
      unitDiscount(PromotionType.PERCENTAGE, '15', '33.33').toFixed(2),
    ).toBe('5.00');
    expect(
      unitDiscount(PromotionType.PERCENTAGE, '12.5', '10.10').toFixed(2),
    ).toBe('1.26');
    expect(unitDiscount(PromotionType.FIXED_AMOUNT, '5', '30').toFixed(2)).toBe(
      '5.00',
    );
    expect(
      unitDiscount(PromotionType.FIXED_AMOUNT, '50', '30').toFixed(2),
    ).toBe('30.00');
    expect(unitDiscount(PromotionType.PERCENTAGE, '100', '30').toFixed(2)).toBe(
      '30.00',
    );
  });

  it('no acumula: elige la de mayor descuento y desempata por vencimiento', () => {
    const candidates = [
      {
        id: 'b',
        name: '10 %',
        type: PromotionType.PERCENTAGE,
        value: '10',
        endsAt: at('2027-01-10'),
      },
      {
        id: 'a',
        name: 'Q5',
        type: PromotionType.FIXED_AMOUNT,
        value: '5',
        endsAt: at('2027-01-20'),
      },
      {
        id: 'c',
        name: 'Q5 antes',
        type: PromotionType.FIXED_AMOUNT,
        value: '5',
        endsAt: at('2027-01-05'),
      },
    ];
    // Sobre Q40: 10 % = Q4, Q5 fijo gana; entre los dos de Q5 gana el que vence antes.
    expect(bestPromotion(candidates, '40')).toMatchObject({
      promotionId: 'c',
      name: 'Q5 antes',
    });
    // Sobre Q80: 10 % = Q8 gana.
    expect(bestPromotion(candidates, '80')?.unitDiscount.toFixed(2)).toBe(
      '8.00',
    );
    expect(bestPromotion([], '80')).toBeNull();
  });
});
