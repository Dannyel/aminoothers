import { fail } from '@sveltejs/kit';
import type { BankAccount, OrderDetail } from '#lib/api/types.ts';
import { failFromApi, loadError, optionalText, text } from '#lib/server/forms.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	try {
		const order = await locals.api.request<OrderDetail>(
			`/store/orders/${encodeURIComponent(params.id)}`
		);
		const bankAccounts = order.canSubmitTransfer
			? await locals.api.request<BankAccount[]>('/store/bank-accounts')
			: [];
		return { order, bankAccounts };
	} catch (err) {
		loadError(err);
	}
};

export const actions: Actions = {
	cancel: async ({ request, locals, params }) => {
		const reason = optionalText(await request.formData(), 'reason');
		try {
			await locals.api.request(`/store/orders/${encodeURIComponent(params.id)}/cancel`, {
				method: 'POST',
				body: { reason }
			});
			return { success: 'Pedido cancelado. Los productos reservados quedaron liberados.' };
		} catch (err) {
			return failFromApi(err);
		}
	},

	/** Reenvía el comprobante (multipart) a la API, que valida tipo, tamaño y contenido. */
	transfer: async ({ request, locals, params }) => {
		const data = await request.formData();
		const file = data.get('file');
		const values = {
			bankAccountId: text(data, 'bankAccountId'),
			bankReference: text(data, 'bankReference').toUpperCase(),
			transferDate: text(data, 'transferDate')
		};
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { messages: ['Adjunte el comprobante de la transferencia.'], values });
		}
		const body = new FormData();
		for (const [key, value] of Object.entries(values)) body.append(key, value);
		body.append('file', file, file.name);
		try {
			await locals.api.request(`/store/orders/${encodeURIComponent(params.id)}/transfer`, {
				method: 'POST',
				body,
				timeoutMs: 30_000
			});
			return {
				success:
					'Recibimos su comprobante. La farmacia verificará el pago; el estado del pedido se actualiza en esta página.'
			};
		} catch (err) {
			return failFromApi(err, values);
		}
	}
};
