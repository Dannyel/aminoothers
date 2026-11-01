import type { NotificationPage } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { loadError } from '#lib/server/forms.ts';
import type { PageServerLoad } from './$types';

const STATUSES = ['PENDING', 'SENT', 'FAILED'];
const TYPES = [
	'ORDER_PLACED',
	'ORDER_STATUS_CHANGED',
	'STAFF_TRANSFER_TO_VERIFY',
	'STAFF_INVENTORY_DIGEST'
];

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'notifications.manage');
	const param = (name: string) => (url.searchParams.get(name) ?? '').trim();
	const filters = {
		search: param('search').slice(0, 100),
		status: STATUSES.includes(param('status')) ? param('status') : '',
		type: TYPES.includes(param('type')) ? param('type') : ''
	};
	const page = Math.max(1, Number.parseInt(param('page') || '1', 10) || 1);
	const query = new URLSearchParams({ page: String(page), pageSize: '25' });
	for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
	try {
		return {
			filters,
			notifications: await locals.api.request<NotificationPage>(`/admin/notifications?${query}`)
		};
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};
