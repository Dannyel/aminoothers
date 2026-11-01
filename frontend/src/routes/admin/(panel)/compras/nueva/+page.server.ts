import { redirect } from '@sveltejs/kit';
import type { PurchaseOrderDetail } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError } from '#lib/server/forms.ts';
import { loadOrderFormOptions, orderFromForm } from '#lib/server/purchase-orders.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'purchases.manage');
	try {
		return await loadOrderFormOptions(locals.api);
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		let order: PurchaseOrderDetail;
		try {
			order = await locals.api.request<PurchaseOrderDetail>('/admin/purchase-orders', {
				method: 'POST',
				body: orderFromForm(await request.formData())
			});
		} catch (err) {
			return failFromApi(err, undefined, { loginPath: ADMIN_LOGIN });
		}
		redirect(303, `/admin/compras/${order.id}`);
	}
};
