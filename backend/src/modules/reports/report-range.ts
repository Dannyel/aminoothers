import { BadRequestException } from '@nestjs/common';
import { addDays, businessDayStart } from '../../common/utils/dates.js';
import { OrderStatus } from '../../generated/prisma/enums.js';

/** Rango máximo de un reporte, en días. */
export const MAX_REPORT_DAYS = 366;

/**
 * Estados que cuentan como venta: el pedido se confirmó (pago verificado o
 * contra entrega confirmado) y no se canceló ni regresó sin entregarse.
 */
export const SALE_STATUSES: readonly OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.DELIVERY_FAILED,
];

/** Días AAAA-MM-DD del rango, ambos extremos incluidos. */
export function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

/**
 * Valida el rango y lo convierte a instantes: desde el inicio de `from`
 * hasta el inicio del día siguiente a `to`, en hora de Guatemala.
 */
export function reportWindow(
  from: string,
  to: string,
): { start: Date; end: Date } {
  if (to < from)
    throw new BadRequestException('El rango de fechas es inválido');
  if (addDays(from, MAX_REPORT_DAYS) <= to) {
    throw new BadRequestException(
      `El rango no puede superar ${MAX_REPORT_DAYS} días`,
    );
  }
  return {
    start: businessDayStart(from),
    end: businessDayStart(addDays(to, 1)),
  };
}
