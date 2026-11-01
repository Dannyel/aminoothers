import {
  NotificationType,
  OrderStatus,
  PaymentMethod,
} from '../../generated/prisma/enums.js';
import type { OrderStatusPayload } from './notification-payloads.js';
import { renderNotification } from './notification-templates.js';

const ctx = { frontendUrl: 'https://farmacia.gt', storeName: 'Farmacia' };

const status = (
  overrides: Partial<OrderStatusPayload>,
): OrderStatusPayload => ({
  orderId: 'o-1',
  number: 7,
  customerName: 'Ana',
  paymentMethod: PaymentMethod.BANK_TRANSFER,
  total: '156.00',
  from: OrderStatus.PREPARING,
  to: OrderStatus.SHIPPED,
  note: null,
  reservationExpiresAt: null,
  shipment: null,
  ...overrides,
});

describe('plantillas de notificación', () => {
  it('el despacho incluye la guía y enlaza al rastreo', () => {
    const mail = renderNotification(
      NotificationType.ORDER_STATUS_CHANGED,
      status({
        shipment: {
          courier: 'Cargo Expreso',
          trackingNumber: 'G-123',
          trackingUrl: 'https://rastreo.gt/G-123',
        },
      }),
      ctx,
    );
    expect(mail.subject).toBe('Su pedido PED-000007 va en camino');
    expect(mail.text).toContain('Cargo Expreso');
    expect(mail.text).toContain('Número de guía: G-123');
    expect(mail.text).toContain('Rastrear mi envío: https://rastreo.gt/G-123');
  });

  it('el rechazo del comprobante muestra el motivo y el nuevo plazo', () => {
    const mail = renderNotification(
      NotificationType.ORDER_STATUS_CHANGED,
      status({
        from: OrderStatus.PAYMENT_IN_REVIEW,
        to: OrderStatus.PENDING_PAYMENT,
        note: 'Monto no coincide',
        reservationExpiresAt: '2026-11-02T18:00:00.000Z',
      }),
      ctx,
    );
    expect(mail.subject).toContain('No pudimos verificar el pago');
    expect(mail.text).toContain('Motivo: Monto no coincide');
    expect(mail.text).toContain('antes del 2 de noviembre de 2026');
    expect(mail.text).toContain('https://farmacia.gt/cuenta/pedidos/o-1');
  });

  it('la confirmación distingue transferencia de contra entrega', () => {
    const transfer = renderNotification(
      NotificationType.ORDER_STATUS_CHANGED,
      status({
        from: OrderStatus.PAYMENT_IN_REVIEW,
        to: OrderStatus.CONFIRMED,
      }),
      ctx,
    );
    const cod = renderNotification(
      NotificationType.ORDER_STATUS_CHANGED,
      status({
        from: OrderStatus.PENDING_CONFIRMATION,
        to: OrderStatus.CONFIRMED,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      }),
      ctx,
    );
    expect(transfer.subject).toBe(
      'Pago verificado: pedido PED-000007 confirmado',
    );
    expect(cod.text).toContain('Pagará Q 156.00 en efectivo');
  });

  it('escapa en el HTML los textos que vienen del usuario', () => {
    const mail = renderNotification(
      NotificationType.ORDER_STATUS_CHANGED,
      status({
        to: OrderStatus.CANCELLED,
        customerName: '<script>x</script>',
        note: 'a & b',
      }),
      ctx,
    );
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.html).toContain('Motivo: a &amp; b');
  });

  it('el resumen de inventario solo lista las alertas presentes', () => {
    const mail = renderNotification(
      NotificationType.STAFF_INVENTORY_DIGEST,
      {
        date: '2026-11-01',
        lowStockProducts: 3,
        expiredLots: 0,
        nearExpiryLots: 2,
        quarantineLots: 0,
        recalledLots: 0,
      },
      ctx,
    );
    expect(mail.text).toContain('3 producto(s) con existencias bajas');
    expect(mail.text).toContain('2 lote(s) próximos a vencer');
    expect(mail.text).not.toContain('vencidos');
    expect(mail.text).toContain('https://farmacia.gt/admin/inventario');
  });
});
