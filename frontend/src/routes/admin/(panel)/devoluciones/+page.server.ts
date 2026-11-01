import type { ReturnPage } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { loadError } from '#lib/server/forms.ts';
import type { PageServerLoad } from './$types';

const STATUSES = ['REQUESTED', 'APPROVED', 'RECEIVED', 'CLOSED', 'REJECTED'];

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'orders.read');
	const requested = url.searchParams.get('status') ?? '';
	const status = STATUSES.includes(requested) ? requested : '';
	const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
	const query = new URLSearchParams({ page: String(page), pageSize: '25' });
	if (status) query.set('status', status);
	try {
		return {
			status,
			statuses: STATUSES,
			returns: await locals.api.request<ReturnPage>(`/admin/returns?${query}`)
		};
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};
