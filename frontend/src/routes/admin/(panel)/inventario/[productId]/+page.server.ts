import type { LotPage, ProductDetail } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError, optionalText, text } from '#lib/server/forms.ts';
import { lotActions } from '#lib/server/lot-actions.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	requirePermission(locals, 'inventory.read');
	const id = encodeURIComponent(params.productId);
	const withStock = url.searchParams.get('todos') === null;
	try {
		const [product, lots] = await Promise.all([
			locals.api.request<ProductDetail>(`/admin/products/${id}`),
			locals.api.request<LotPage>(
				`/admin/inventory/lots?productId=${id}&pageSize=100&withStock=${withStock}`
			)
		]);
		return { product, lots, withStock };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

export const actions: Actions = {
	...lotActions,

	createLot: async ({ request, locals, params }) => {
		const data = await request.formData();
		const values = {
			productId: params.productId,
			lotNumber: text(data, 'lotNumber'),
			expirationDate: optionalText(data, 'expirationDate'),
			manufacturingDate: optionalText(data, 'manufacturingDate'),
			quantity: Number(text(data, 'quantity')),
			unitCost: text(data, 'unitCost').replace(',', '.'),
			status: text(data, 'status') || undefined,
			notes: optionalText(data, 'notes')
		};
		try {
			await locals.api.request('/admin/inventory/lots', { method: 'POST', body: values });
			return { success: `Lote ${values.lotNumber} registrado.` };
		} catch (err) {
			return failFromApi(err, values, { loginPath: ADMIN_LOGIN });
		}
	}
};
