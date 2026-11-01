import type { LotPage } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { loadError } from '#lib/server/forms.ts';
import { lotActions } from '#lib/server/lot-actions.ts';
import type { Actions, PageServerLoad } from './$types';

const STATUSES = ['AVAILABLE', 'QUARANTINE', 'RECALLED', 'BLOCKED'];

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'inventory.read');
	const params = url.searchParams;
	const filters = {
		search: (params.get('search') ?? '').trim().slice(0, 100),
		expiry: ['expired', 'near'].includes(params.get('expiry') ?? '')
			? params.get('expiry')!
			: 'all',
		status: STATUSES.includes(params.get('status') ?? '') ? params.get('status')! : ''
	};
	const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
	const query = new URLSearchParams({ page: String(page), pageSize: '25', expiry: filters.expiry });
	if (filters.search) query.set('search', filters.search);
	if (filters.status) query.set('status', filters.status);
	try {
		return {
			lots: await locals.api.request<LotPage>(`/admin/inventory/lots?${query}`),
			filters
		};
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

export const actions: Actions = lotActions;
