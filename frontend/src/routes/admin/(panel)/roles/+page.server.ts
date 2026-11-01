import type { Role } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { loadError } from '#lib/server/forms.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'roles.read');
	try {
		return { roles: await locals.api.request<Role[]>('/admin/roles') };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};
