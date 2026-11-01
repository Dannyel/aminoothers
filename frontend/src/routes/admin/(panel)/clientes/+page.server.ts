import type { CustomerPage } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { loadError } from '#lib/server/forms.ts';
import { listQuery } from '#lib/server/list-query.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'customers.read');
	const { search, status, query } = listQuery(url);
	try {
		const result = await locals.api.request<CustomerPage>(`/admin/customers?${query}`);
		return { result, search, status };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};
