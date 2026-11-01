import type { IncomeReport } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { loadError } from '#lib/server/forms.ts';
import type { PageServerLoad } from './$types';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const today = () =>
	new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date());

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'billing.read');
	const now = today();
	const from = DATE.test(url.searchParams.get('from') ?? '')
		? url.searchParams.get('from')!
		: `${now.slice(0, 8)}01`;
	const to = DATE.test(url.searchParams.get('to') ?? '') ? url.searchParams.get('to')! : now;
	try {
		return {
			from,
			to,
			report: await locals.api.request<IncomeReport>(`/admin/billing/income?from=${from}&to=${to}`)
		};
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};
