import type { AdminOrderDetail, Courier } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { loadError } from '#lib/server/forms.ts';
import { orderActions } from '#lib/server/order-actions.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals, 'orders.read');
	try {
		const order = await locals.api.request<AdminOrderDetail>(
			`/admin/orders/${encodeURIComponent(params.id)}`
		);
		const couriers = order.actions.includes('dispatch')
			? (await locals.api.request<Courier[]>('/admin/couriers')).filter((c) => c.isActive)
			: [];
		return { order, couriers };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

export const actions = orderActions;
