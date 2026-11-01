import type { TaxRateAdmin } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError, text } from '#lib/server/forms.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'billing.read');
	try {
		return { rates: await locals.api.request<TaxRateAdmin[]>('/admin/billing/tax-rates') };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

const opts = { loginPath: ADMIN_LOGIN };

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const data = await request.formData();
		try {
			await locals.api.request('/admin/billing/tax-rates', {
				method: 'POST',
				body: {
					code: text(data, 'code').toUpperCase(),
					name: text(data, 'name'),
					ratePercent: text(data, 'ratePercent'),
					isDefault: data.get('isDefault') === 'on'
				}
			});
			return { success: 'Tasa agregada.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},
	update: async ({ request, locals }) => {
		const data = await request.formData();
		try {
			await locals.api.request(`/admin/billing/tax-rates/${encodeURIComponent(text(data, 'id'))}`, {
				method: 'PATCH',
				body: {
					name: text(data, 'name'),
					ratePercent: text(data, 'ratePercent'),
					isActive: data.get('isActive') === 'on',
					...(data.get('isDefault') === 'on' ? { isDefault: true } : {})
				}
			});
			return { success: 'Tasa actualizada. El cambio aplica a las ventas siguientes.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	}
};
