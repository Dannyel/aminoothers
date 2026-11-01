// Acciones sobre lotes, compartidas por la página del producto y la de lotes.
import type { RequestEvent } from '@sveltejs/kit';
import { ADMIN_LOGIN } from './admin.ts';
import { failFromApi, optionalText, text } from './forms.ts';

const opts = { loginPath: ADMIN_LOGIN };
const lotPath = (id: string, suffix = '') =>
	`/admin/inventory/lots/${encodeURIComponent(id)}${suffix}`;

export const lotActions = {
	adjust: async ({ request, locals }: RequestEvent) => {
		const data = await request.formData();
		const correction = text(data, 'correctsMovementNumber');
		try {
			await locals.api.request(lotPath(text(data, 'lotId'), '/adjustments'), {
				method: 'POST',
				body: {
					direction: text(data, 'direction'),
					quantity: Number(text(data, 'quantity')),
					reasonCode: text(data, 'reasonCode'),
					notes: text(data, 'notes'),
					correctsMovementNumber: correction ? Number(correction) : undefined
				}
			});
			return { success: 'Ajuste registrado.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},

	outflow: async ({ request, locals }: RequestEvent) => {
		const data = await request.formData();
		try {
			await locals.api.request(lotPath(text(data, 'lotId'), '/outflows'), {
				method: 'POST',
				body: {
					quantity: Number(text(data, 'quantity')),
					reasonCode: text(data, 'reasonCode'),
					notes: optionalText(data, 'notes')
				}
			});
			return { success: 'Baja registrada.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},

	status: async ({ request, locals }: RequestEvent) => {
		const data = await request.formData();
		try {
			await locals.api.request(lotPath(text(data, 'lotId'), '/status'), {
				method: 'PATCH',
				body: { status: text(data, 'status'), reason: optionalText(data, 'reason') }
			});
			return { success: 'Estado del lote actualizado.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	}
};
