import type { Invoice, StoreInfo } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError, text } from '#lib/server/forms.ts';
import { guatemalaDateTime } from '#lib/server/promotions.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals, 'billing.read');
	try {
		const [invoice, info] = await Promise.all([
			locals.api.request<Invoice>(`/admin/billing/invoices/${encodeURIComponent(params.id)}`),
			locals.api.request<StoreInfo>('/store/info')
		]);
		return { invoice, info };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

const opts = { loginPath: ADMIN_LOGIN };

export const actions: Actions = {
	fel: async ({ request, locals, params }) => {
		const data = await request.formData();
		const values = {
			authorizationUuid: text(data, 'authorizationUuid'),
			series: text(data, 'series'),
			number: text(data, 'number'),
			certifier: text(data, 'certifier'),
			certifiedAt: guatemalaDateTime(text(data, 'certifiedAt'))
		};
		try {
			await locals.api.request(`/admin/billing/invoices/${encodeURIComponent(params.id)}/fel`, {
				method: 'PUT',
				body: values
			});
			return { success: 'Datos de la FEL registrados.' };
		} catch (err) {
			return failFromApi(err, values, opts);
		}
	},
	void: async ({ request, locals, params }) => {
		const reason = text(await request.formData(), 'reason');
		try {
			await locals.api.request(`/admin/billing/invoices/${encodeURIComponent(params.id)}/void`, {
				method: 'POST',
				body: { reason }
			});
			return { success: 'Comprobante anulado.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	}
};
