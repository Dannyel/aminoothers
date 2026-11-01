// Acciones del detalle de pedido del panel. Cada una reenvía a la API, que
// valida el estado del pedido y los permisos; aquí solo se arma el cuerpo.
import type { Actions } from '@sveltejs/kit';
import { ADMIN_LOGIN } from './admin.ts';
import { failFromApi, optionalText, text } from './forms.ts';

type Body = Record<string, unknown>;
type BodyBuilder = (data: FormData) => Body;

const note: BodyBuilder = (d) => ({ note: optionalText(d, 'note') });

/** Acción → [ruta relativa al pedido o absoluta, cuerpo, mensaje de éxito]. */
const ORDER_ACTIONS: Record<string, [string, BodyBuilder, string]> = {
	confirm: ['confirm', note, 'Pedido confirmado.'],
	prepare: ['prepare', note, 'Pedido en preparación.'],
	dispatch: [
		'dispatch',
		(d) => ({
			courierId: text(d, 'courierId'),
			trackingNumber: optionalText(d, 'trackingNumber'),
			courierCost: optionalText(d, 'courierCost'),
			notes: optionalText(d, 'notes')
		}),
		'Pedido despachado: el inventario se descontó de los lotes reservados.'
	],
	event: [
		'shipment/events',
		(d) => ({
			status: text(d, 'status'),
			description: text(d, 'description'),
			location: optionalText(d, 'location')
		}),
		'Seguimiento registrado.'
	],
	deliver: [
		'deliver',
		(d) => ({
			receivedByName: optionalText(d, 'receivedByName'),
			collectedAmount: optionalText(d, 'collectedAmount'),
			note: optionalText(d, 'note')
		}),
		'Entrega registrada.'
	],
	fail: ['delivery-failed', (d) => ({ note: text(d, 'note') }), 'Entrega fallida registrada.'],
	redispatch: [
		'redispatch',
		(d) => ({ trackingNumber: optionalText(d, 'trackingNumber'), note: optionalText(d, 'note') }),
		'Nuevo intento de entrega registrado.'
	],
	returnToStore: [
		'return-to-store',
		(d) => ({ note: text(d, 'note') }),
		'Paquete devuelto: las unidades quedaron pendientes de inspección.'
	],
	cancel: ['cancel', (d) => ({ reason: text(d, 'reason') }), 'Pedido cancelado.']
};

async function post(locals: App.Locals, path: string, body: Body, success: string) {
	try {
		await locals.api.request(path, { method: 'POST', body });
		return { success };
	} catch (err) {
		return failFromApi(err, undefined, { loginPath: ADMIN_LOGIN });
	}
}

const orderPath = (id: string, action: string) =>
	`/admin/orders/${encodeURIComponent(id)}/${action}`;

export const orderActions: Actions = {
	...Object.fromEntries(
		Object.entries(ORDER_ACTIONS).map(([name, [path, build, success]]) => [
			name,
			async ({ request, locals, params }) =>
				post(locals, orderPath(params.id!, path), build(await request.formData()), success)
		])
	),

	approvePayment: async ({ request, locals }) => {
		const id = text(await request.formData(), 'paymentId');
		return post(
			locals,
			`/admin/payments/${encodeURIComponent(id)}/approve`,
			{},
			'Pago aprobado: el pedido quedó confirmado.'
		);
	},

	rejectPayment: async ({ request, locals }) => {
		const data = await request.formData();
		return post(
			locals,
			`/admin/payments/${encodeURIComponent(text(data, 'paymentId'))}/reject`,
			{ reason: text(data, 'reason') },
			'Pago rechazado: el cliente puede enviar otro comprobante.'
		);
	},

	createRefund: async ({ request, locals }) => {
		const data = await request.formData();
		return post(
			locals,
			`/admin/payments/${encodeURIComponent(text(data, 'paymentId'))}/refunds`,
			{
				amount: text(data, 'amount'),
				method: text(data, 'method'),
				reason: text(data, 'reason'),
				returnId: optionalText(data, 'returnId')
			},
			'Reembolso registrado como pendiente.'
		);
	},

	completeRefund: async ({ request, locals }) => {
		const data = await request.formData();
		return post(
			locals,
			`/admin/refunds/${encodeURIComponent(text(data, 'refundId'))}/complete`,
			{ reference: text(data, 'reference') },
			'Reembolso completado.'
		);
	},

	cancelRefund: async ({ request, locals }) => {
		const id = text(await request.formData(), 'refundId');
		return post(
			locals,
			`/admin/refunds/${encodeURIComponent(id)}/cancel`,
			{},
			'Reembolso anulado.'
		);
	},

	createReturn: async ({ request, locals, params }) => {
		const data = await request.formData();
		const ids = data.getAll('orderItemId').map(String);
		const quantities = data.getAll('quantity').map((q) => Number.parseInt(String(q), 10) || 0);
		const items = ids
			.map((orderItemId, i) => ({ orderItemId, quantity: quantities[i] ?? 0 }))
			.filter((i) => i.quantity > 0);
		return post(
			locals,
			orderPath(params.id!, 'returns'),
			{ reason: text(data, 'reason'), notes: optionalText(data, 'notes'), items },
			'Devolución registrada.'
		);
	}
};
