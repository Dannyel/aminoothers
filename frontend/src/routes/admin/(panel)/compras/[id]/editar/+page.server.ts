import { redirect } from '@sveltejs/kit';
import type { PurchaseOrderDetail } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError } from '#lib/server/forms.ts';
import { loadOrderFormOptions, orderFromForm } from '#lib/server/purchase-orders.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals, 'purchases.manage');
	try {
		const [order, options] = await Promise.all([
			locals.api.request<PurchaseOrderDetail>(
				`/admin/purchase-orders/${encodeURIComponent(params.id)}`
			),
			loadOrderFormOptions(locals.api)
		]);
		if (order.status !== 'DRAFT') redirect(303, `/admin/compras/${order.id}`);
		return { order, ...options };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

export const actions: Actions = {
	default: async ({ request, locals, params }) => {
		try {
			await locals.api.request(`/admin/purchase-orders/${encodeURIComponent(params.id)}`, {
				method: 'PUT',
				body: orderFromForm(await request.formData())
			});
		} catch (err) {
			return failFromApi(err, undefined, { loginPath: ADMIN_LOGIN });
		}
		redirect(303, `/admin/compras/${params.id}`);
	}
};
