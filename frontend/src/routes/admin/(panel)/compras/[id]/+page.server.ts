import type { PurchaseOrderDetail } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError } from '#lib/server/forms.ts';
import { receiptFromForm } from '#lib/server/purchase-orders.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals, 'purchases.read');
	try {
		return {
			order: await locals.api.request<PurchaseOrderDetail>(
				`/admin/purchase-orders/${encodeURIComponent(params.id)}`
			)
		};
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

const opts = { loginPath: ADMIN_LOGIN };
const path = (id: string, action: string) =>
	`/admin/purchase-orders/${encodeURIComponent(id)}/${action}`;

const transition = (action: 'approve' | 'cancel' | 'close', message: string) =>
	(async ({ locals, params }) => {
		try {
			await locals.api.request(path(params.id, action), { method: 'POST' });
			return { success: message };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	}) satisfies Actions[string];

export const actions: Actions = {
	approve: transition('approve', 'Orden aprobada.'),
	cancel: transition('cancel', 'Orden cancelada.'),
	close: transition('close', 'Orden cerrada con faltante.'),

	receive: async ({ request, locals, params }) => {
		const body = receiptFromForm(await request.formData());
		if (body.items.length === 0) {
			return { messages: ['Indique la cantidad recibida en al menos una línea.'] };
		}
		try {
			await locals.api.request(path(params.id, 'receipts'), { method: 'POST', body });
			return { success: 'Recepción registrada: las existencias ya están en inventario.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	}
};
