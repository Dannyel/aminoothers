import type { PromotionPage } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { loadError } from '#lib/server/forms.ts';
import type { PageServerLoad } from './$types';

const STATES = ['ACTIVE', 'SCHEDULED', 'EXPIRED', 'INACTIVE'];

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'promotions.read');
	const state = STATES.includes(url.searchParams.get('state') ?? '')
		? url.searchParams.get('state')!
		: '';
	const search = (url.searchParams.get('search') ?? '').trim().slice(0, 100);
	const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
	const query = new URLSearchParams({ page: String(page), pageSize: '25' });
	if (state) query.set('state', state);
	if (search) query.set('search', search);
	try {
		return {
			state,
			search,
			states: STATES,
			promotions: await locals.api.request<PromotionPage>(`/admin/promotions?${query}`)
		};
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};
