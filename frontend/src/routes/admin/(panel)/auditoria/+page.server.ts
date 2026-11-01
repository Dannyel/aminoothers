import type { AuditFilters, AuditPage } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { loadError } from '#lib/server/forms.ts';
import type { PageServerLoad } from './$types';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'audit.read');
	const param = (name: string) => (url.searchParams.get(name) ?? '').trim();
	const filters = {
		search: param('search').slice(0, 100),
		module: /^[a-z0-9-]{1,40}$/.test(param('module')) ? param('module') : '',
		userId: UUID.test(param('userId')) ? param('userId') : '',
		entityId: param('entityId').slice(0, 64),
		from: DATE.test(param('from')) ? param('from') : '',
		to: DATE.test(param('to')) ? param('to') : ''
	};
	const page = Math.max(1, Number.parseInt(param('page') || '1', 10) || 1);
	const query = new URLSearchParams({ page: String(page), pageSize: '50' });
	for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
	try {
		const [logs, options] = await Promise.all([
			locals.api.request<AuditPage>(`/admin/audit?${query}`),
			locals.api.request<AuditFilters>('/admin/audit/filters')
		]);
		return { filters, logs, options };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};
