import type { PaymentPage } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { loadError } from '#lib/server/forms.ts';
import type { PageServerLoad } from './$types';

const STATUSES = [
	'IN_REVIEW',
	'PENDING',
	'APPROVED',
	'REJECTED',
	'CANCELLED',
	'PARTIALLY_REFUNDED',
	'REFUNDED'
];

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'orders.read');
	const requested = url.searchParams.get('status') ?? 'IN_REVIEW';
	const status = STATUSES.includes(requested) ? requested : 'IN_REVIEW';
	const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
	try {
		return {
			status,
			statuses: STATUSES,
			payments: await locals.api.request<PaymentPage>(
				`/admin/payments?status=${status}&page=${page}&pageSize=25`
			)
		};
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};
