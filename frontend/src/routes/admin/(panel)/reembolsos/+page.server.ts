import type { RefundPage } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { loadError } from '#lib/server/forms.ts';
import { orderActions } from '#lib/server/order-actions.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'orders.read');
	const requested = url.searchParams.get('status') ?? 'PENDING';
	const status = ['PENDING', 'COMPLETED', 'CANCELLED'].includes(requested) ? requested : 'PENDING';
	const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
	try {
		return {
			status,
			refunds: await locals.api.request<RefundPage>(
				`/admin/refunds?status=${status}&page=${page}&pageSize=25`
			)
		};
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

export const actions = {
	completeRefund: orderActions.completeRefund,
	cancelRefund: orderActions.cancelRefund
};
