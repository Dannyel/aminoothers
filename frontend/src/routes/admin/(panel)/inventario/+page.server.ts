import type { InventoryAlerts, InventorySettings, ProductStockPage } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError, text } from '#lib/server/forms.ts';
import type { Actions, PageServerLoad } from './$types';

const ALERTS = ['low', 'expired', 'near', 'quarantine'];

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'inventory.read');
	const alert = ALERTS.includes(url.searchParams.get('alerta') ?? '')
		? url.searchParams.get('alerta')!
		: 'all';
	const search = (url.searchParams.get('search') ?? '').trim().slice(0, 100);
	const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
	const query = new URLSearchParams({ page: String(page), pageSize: '25', alert });
	if (search) query.set('search', search);
	try {
		const [stock, alerts, settings] = await Promise.all([
			locals.api.request<ProductStockPage>(`/admin/inventory/stock?${query}`),
			locals.api.request<InventoryAlerts>('/admin/inventory/alerts'),
			locals.api.request<InventorySettings>('/admin/inventory/settings')
		]);
		return { stock, alerts, settings, alert, search };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

export const actions: Actions = {
	settings: async ({ request, locals }) => {
		const data = await request.formData();
		try {
			await locals.api.request('/admin/inventory/settings', {
				method: 'PUT',
				body: {
					minShelfLifeDaysForSale: Number(text(data, 'minShelfLifeDaysForSale')),
					nearExpiryDays: Number(text(data, 'nearExpiryDays'))
				}
			});
			return { success: 'Parámetros actualizados.' };
		} catch (err) {
			return failFromApi(err, undefined, { loginPath: ADMIN_LOGIN });
		}
	}
};
