import type { InvoicePage } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { loadError } from '#lib/server/forms.ts';
import type { PageServerLoad } from './$types';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'billing.read');
	const param = (name: string) => (url.searchParams.get(name) ?? '').trim();
	const filters = {
		search: param('search').slice(0, 100),
		status: ['ISSUED', 'VOIDED'].includes(param('status')) ? param('status') : '',
		felStatus: ['PENDING', 'CERTIFIED', 'NOT_APPLICABLE'].includes(param('felStatus'))
			? param('felStatus')
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
			invoices: await locals.api.request<InvoicePage>(`/admin/billing/invoices?${query}`)
		};
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};
