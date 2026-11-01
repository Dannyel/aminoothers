import type { AdminOrderSummaryPage } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { loadError } from '#lib/server/forms.ts';
import type { PageServerLoad } from './$types';

const STATUSES = [
	'PENDING_PAYMENT',
	'PAYMENT_IN_REVIEW',
	'PENDING_CONFIRMATION',
	'CONFIRMED',
	'PREPARING',
	'SHIPPED',
	'DELIVERED',
	'DELIVERY_FAILED',
	'RETURNED_TO_STORE',
	'CANCELLED',
	'EXPIRED'
];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'orders.read');
	const param = (name: string) => (url.searchParams.get(name) ?? '').trim();
	const filters = {
		search: param('search').slice(0, 100),
		status: STATUSES.includes(param('status')) ? param('status') : '',
		paymentMethod: ['BANK_TRANSFER', 'CASH_ON_DELIVERY'].includes(param('paymentMethod'))
			? param('paymentMethod')
			: '',
		from: DATE.test(param('from')) ? param('from') : '',
		to: DATE.test(param('to')) ? param('to') : ''
	};
	const page = Math.max(1, Number.parseInt(param('page') || '1', 10) || 1);
	const query = new URLSearchParams({ page: String(page), pageSize: '25' });
	for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
	try {
		return {
			filters,
			statuses: STATUSES,
			orders: await locals.api.request<AdminOrderSummaryPage>(`/admin/orders?${query}`)
		};
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};
