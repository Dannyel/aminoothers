import { BUSINESS_TIME_ZONE } from '../../common/utils/dates.js';
import {
  NotificationType,
  OrderStatus,
  PaymentMethod,
} from '../../generated/prisma/enums.js';
import { renderMail } from '../mail/mail-layout.js';
import { orderLabel } from '../orders/order-label.js';
import type {
  InventoryDigestPayload,
  NotificationPayloads,
  OrderPlacedPayload,
  OrderStatusPayload,
  TransferToVerifyPayload,
} from './notification-payloads.js';

export interface TemplateContext {
  frontendUrl: string;
  storeName: string;
}

export const money = (amount: string): string =>
  `Q ${Number(amount).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dateTime = (iso: string): string =>
  new Intl.DateTimeFormat('es-GT', {
    timeZone: BUSINESS_TIME_ZONE,
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(iso));

const NOT_INVOICE = 'Este correo es informativo; no constituye factura.';

/** Estados del pedido que se avisan al cliente. */
export const CUSTOMER_NOTIFIED_STATUSES: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.CONFIRMED,
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.DELIVERY_FAILED,
  OrderStatus.RETURNED_TO_STORE,
  OrderStatus.CANCELLED,
  OrderStatus.EXPIRED,
]);

function orderPlaced(p: OrderPlacedPayload, ctx: TemplateContext) {
  const label = orderLabel(p.number);
  const lines = p.items.map(
    (i) => `• ${i.quantity} × ${i.name}: ${money(i.lineTotal)}`,
  );
  const payment =
    p.paymentMethod === PaymentMethod.BANK_TRANSFER
      ? `Forma de pago: transferencia bancaria. Reservamos sus productos hasta el ${dateTime(p.reservationExpiresAt!)}; registre su comprobante en su pedido antes de esa hora o el pedido se cancelará automáticamente.`
      : `Forma de pago: efectivo contra entrega. Nuestro equipo confirmará su pedido y usted pagará ${money(p.total)} al recibirlo.`;
  return renderMail({
    subject: `Recibimos su pedido ${label}`,
    paragraphs: [
      `Hola, ${p.customerName}:`,
      `Recibimos su pedido ${label}.`,
      lines.join('\n'),
      [
        Number(p.discountTotal) > 0
          ? `Descuentos: −${money(p.discountTotal)}`
          : null,
        `Envío (${p.shippingMethodName}): ${money(p.shippingCost)}`,
        `Total: ${money(p.total)} (IVA incluido: ${money(p.taxTotal)})`,
      ]
        .filter(Boolean)
        .join('\n'),
      payment,
      NOT_INVOICE,
      ctx.storeName,
    ],
    action: {
      label: 'Ver mi pedido',
      url: `${ctx.frontendUrl}/cuenta/pedidos/${p.orderId}`,
    },
  });
}

/** Asunto y texto de cada estado avisado. */
function statusMessage(p: OrderStatusPayload): {
  subject: string;
  paragraphs: string[];
} {
  const label = orderLabel(p.number);
  switch (p.to) {
    case OrderStatus.CONFIRMED:
      return p.from === OrderStatus.PAYMENT_IN_REVIEW
        ? {
            subject: `Pago verificado: pedido ${label} confirmado`,
            paragraphs: [
              `Verificamos su transferencia y su pedido ${label} quedó confirmado. Le avisaremos cuando lo enviemos.`,
            ],
          }
        : {
            subject: `Su pedido ${label} fue confirmado`,
            paragraphs: [
              `Confirmamos su pedido ${label}. Pagará ${money(p.total)} en efectivo al recibirlo. Le avisaremos cuando lo enviemos.`,
            ],
          };
    case OrderStatus.PENDING_PAYMENT:
      return {
        subject: `No pudimos verificar el pago del pedido ${label}`,
        paragraphs: [
          `Revisamos el comprobante de transferencia de su pedido ${label} y no pudimos verificarlo.`,
          ...(p.note ? [`Motivo: ${p.note}`] : []),
          p.reservationExpiresAt
            ? `Registre de nuevo su comprobante antes del ${dateTime(p.reservationExpiresAt)}; si no, el pedido se cancelará automáticamente.`
            : 'Registre de nuevo su comprobante desde su pedido.',
        ],
      };
    case OrderStatus.SHIPPED:
      return {
        subject: `Su pedido ${label} va en camino`,
        paragraphs: [
          `Entregamos su pedido ${label} a ${p.shipment?.courier ?? 'la mensajería'}.`,
          ...(p.shipment?.trackingNumber
            ? [`Número de guía: ${p.shipment.trackingNumber}`]
            : []),
          ...(p.paymentMethod === PaymentMethod.CASH_ON_DELIVERY
            ? [`Tenga listo el pago de ${money(p.total)} en efectivo.`]
            : []),
        ],
      };
    case OrderStatus.DELIVERED:
      return {
        subject: `Su pedido ${label} fue entregado`,
        paragraphs: [
          `Su pedido ${label} fue entregado. Gracias por su compra.`,
          'Puede consultar su comprobante en el detalle del pedido.',
        ],
      };
    case OrderStatus.DELIVERY_FAILED:
      return {
        subject: `No pudimos entregar su pedido ${label}`,
        paragraphs: [
          `La mensajería no pudo entregar su pedido ${label}. Nos comunicaremos con usted para coordinar un nuevo intento.`,
        ],
      };
    case OrderStatus.RETURNED_TO_STORE:
      return {
        subject: `Su pedido ${label} regresó a la farmacia`,
        paragraphs: [
          `Su pedido ${label} regresó a la farmacia sin entregarse. Comuníquese con nosotros para resolverlo.`,
        ],
      };
    case OrderStatus.CANCELLED:
      return {
        subject: `Su pedido ${label} fue cancelado`,
        paragraphs: [
          `Su pedido ${label} fue cancelado.`,
          ...(p.note ? [`Motivo: ${p.note}`] : []),
        ],
      };
    case OrderStatus.EXPIRED:
      return {
        subject: `Su pedido ${label} se canceló por falta de pago`,
        paragraphs: [
          p.paymentMethod === PaymentMethod.BANK_TRANSFER
            ? `No recibimos el comprobante de pago del pedido ${label} dentro del plazo, así que se canceló y los productos se liberaron.`
            : `No pudimos confirmar el pedido ${label} dentro del plazo, así que se canceló y los productos se liberaron.`,
          'Si aún los necesita, puede hacer un nuevo pedido.',
        ],
      };
    default:
      return {
        subject: `Actualización de su pedido ${label}`,
        paragraphs: [`Su pedido ${label} cambió de estado.`],
      };
  }
}

function orderStatusChanged(p: OrderStatusPayload, ctx: TemplateContext) {
  const message = statusMessage(p);
  const orderUrl = `${ctx.frontendUrl}/cuenta/pedidos/${p.orderId}`;
  const tracking =
    p.to === OrderStatus.SHIPPED ? p.shipment?.trackingUrl : null;
  return renderMail({
    subject: message.subject,
    paragraphs: [
      `Hola, ${p.customerName}:`,
      ...message.paragraphs,
      ...(tracking ? [`Detalle del pedido: ${orderUrl}`] : []),
      ctx.storeName,
    ],
    action: tracking
      ? { label: 'Rastrear mi envío', url: tracking }
      : { label: 'Ver mi pedido', url: orderUrl },
  });
}

function transferToVerify(p: TransferToVerifyPayload, ctx: TemplateContext) {
  const label = orderLabel(p.number);
  return renderMail({
    subject: `Comprobante por verificar: ${label}`,
    paragraphs: [
      `${p.customerName} registró una transferencia${p.bankReference ? ` (referencia ${p.bankReference})` : ''} por ${money(p.total)} para el pedido ${label}.`,
      'Verifíquela contra el estado de cuenta antes de aprobarla.',
    ],
    action: {
      label: 'Verificar pagos',
      url: `${ctx.frontendUrl}/admin/pagos`,
    },
  });
}

function inventoryDigest(p: InventoryDigestPayload, ctx: TemplateContext) {
  const lines = [
    [p.expiredLots, 'lote(s) vencidos con existencia: deben darse de baja'],
    [p.recalledLots, 'lote(s) retirados del mercado con existencia'],
    [p.quarantineLots, 'lote(s) en cuarentena con existencia'],
    [p.nearExpiryLots, 'lote(s) próximos a vencer'],
    [p.lowStockProducts, 'producto(s) con existencias bajas'],
  ]
    .filter(([count]) => Number(count) > 0)
    .map(([count, text]) => `• ${count} ${text}`);
  return renderMail({
    subject: `Alertas de inventario del ${p.date}`,
    paragraphs: [
      `Resumen de inventario de ${ctx.storeName}:`,
      lines.join('\n'),
    ],
    action: {
      label: 'Ver inventario',
      url: `${ctx.frontendUrl}/admin/inventario`,
    },
  });
}

const RENDERERS: {
  [K in NotificationType]: (
    payload: NotificationPayloads[K],
    ctx: TemplateContext,
  ) => ReturnType<typeof renderMail>;
} = {
  [NotificationType.ORDER_PLACED]: orderPlaced,
  [NotificationType.ORDER_STATUS_CHANGED]: orderStatusChanged,
  [NotificationType.STAFF_TRANSFER_TO_VERIFY]: transferToVerify,
  [NotificationType.STAFF_INVENTORY_DIGEST]: inventoryDigest,
};

/** Arma el correo (asunto, texto y HTML) a partir de los datos guardados. */
export function renderNotification<K extends NotificationType>(
  type: K,
  payload: NotificationPayloads[K],
  ctx: TemplateContext,
): ReturnType<typeof renderMail> {
  return RENDERERS[type](payload, ctx);
}
