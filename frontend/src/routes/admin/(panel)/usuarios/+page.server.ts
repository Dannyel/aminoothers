import type { StaffUserPage } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { loadError } from '#lib/server/forms.ts';
import { listQuery } from '#lib/server/list-query.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'users.read');
	const { search, status, query } = listQuery(url);
	try {
		const result = await locals.api.request<StaffUserPage>(`/admin/users?${query}`);
		return { result, search, status };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};
