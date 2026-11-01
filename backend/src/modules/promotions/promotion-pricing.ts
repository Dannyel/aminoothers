import {
  Decimal,
  roundMoney,
  type DecimalInput,
  type DecimalValue,
} from '../../common/utils/money.js';
import { PromotionType } from '../../generated/prisma/enums.js';

export interface PromotionTerms {
  id: string;
  name: string;
  type: PromotionType;
  value: DecimalInput;
  endsAt: Date;
}

export interface AppliedPromotion {
  promotionId: string;
  name: string;
  /** Descuento por unidad, nunca mayor que el precio. */
  unitDiscount: DecimalValue;
  endsAt: Date;
}

/**
 * Descuento unitario de una promoción sobre el precio normal: porcentaje con
 * redondeo comercial, o monto fijo. Nunca supera el precio.
 */
export function unitDiscount(
  type: PromotionType,
  value: DecimalInput,
  price: DecimalInput,
): DecimalValue {
  const base = new Decimal(price);
  const raw =
    type === PromotionType.PERCENTAGE
      ? roundMoney(base.mul(value).div(100))
      : roundMoney(value);
  return Decimal.min(raw, base);
}

/**
 * Las promociones no se acumulan: se aplica solo la de mayor descuento. A igual
 * descuento gana la que vence antes y, si persiste el empate, la de menor id
 * (resultado determinista).
 */
export function bestPromotion(
  candidates: readonly PromotionTerms[],
  price: DecimalInput,
): AppliedPromotion | null {
  let best: AppliedPromotion | null = null;
  for (const p of candidates) {
    const discount = unitDiscount(p.type, p.value, price);
    if (discount.lte(0)) continue;
    const better =
      !best ||
      discount.gt(best.unitDiscount) ||
      (discount.eq(best.unitDiscount) &&
        (p.endsAt < best.endsAt ||
          (p.endsAt.getTime() === best.endsAt.getTime() &&
            p.id < best.promotionId)));
    if (better) {
      best = {
        promotionId: p.id,
        name: p.name,
        unitDiscount: discount,
        endsAt: p.endsAt,
      };
    }
  }
  return best;
}
