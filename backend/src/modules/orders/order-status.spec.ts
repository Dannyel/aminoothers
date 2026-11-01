import { OrderStatus } from '../../generated/prisma/enums.js';
import {
  CUSTOMER_CANCELLABLE,
  ORDER_TRANSITIONS,
  STAFF_CANCELLABLE,
} from './order-status.js';

describe('estados del pedido', () => {
  it('los estados finales no tienen salida', () => {
    for (const status of [
      OrderStatus.DELIVERED,
      OrderStatus.RETURNED_TO_STORE,
      OrderStatus.CANCELLED,
      OrderStatus.EXPIRED,
    ]) {
      expect(ORDER_TRANSITIONS[status]).toEqual([]);
    }
  });

  it('solo los pendientes vencen y nadie cancela un pedido ya enviado', () => {
    const expiring = Object.entries(ORDER_TRANSITIONS)
      .filter(([, to]) => to.includes(OrderStatus.EXPIRED))
      .map(([from]) => from)
      .sort();
    expect(expiring).toEqual(['PENDING_CONFIRMATION', 'PENDING_PAYMENT']);
    expect(ORDER_TRANSITIONS.SHIPPED).not.toContain(OrderStatus.CANCELLED);
    expect(ORDER_TRANSITIONS.DELIVERY_FAILED).not.toContain(
      OrderStatus.CANCELLED,
    );
  });

  it('el cliente cancela antes de confirmar (D8); el personal también después', () => {
    expect(CUSTOMER_CANCELLABLE).not.toContain(OrderStatus.CONFIRMED);
    expect(STAFF_CANCELLABLE).toEqual(
      expect.arrayContaining([OrderStatus.CONFIRMED, OrderStatus.PREPARING]),
    );
    for (const status of STAFF_CANCELLABLE) {
      expect(ORDER_TRANSITIONS[status]).toContain(OrderStatus.CANCELLED);
    }
  });

  it('solo se llega a enviado desde preparación o un reintento', () => {
    const toShipped = Object.entries(ORDER_TRANSITIONS)
      .filter(([, to]) => to.includes(OrderStatus.SHIPPED))
      .map(([from]) => from)
      .sort();
    expect(toShipped).toEqual(['DELIVERY_FAILED', 'PREPARING']);
  });
});
