import { redirect } from '@sveltejs/kit';
import type { Permission, Role } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError, optionalText, text } from '#lib/server/forms.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'roles.manage');
	try {
		return { permissions: await locals.api.request<Permission[]>('/admin/permissions') };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const data = await request.formData();
		const values = {
			code: text(data, 'code'),
			name: text(data, 'name'),
			description: optionalText(data, 'description'),
			permissions: data.getAll('permissions').map(String)
		};
		let role: Role;
		try {
			role = await locals.api.request<Role>('/admin/roles', { method: 'POST', body: values });
		} catch (err) {
			return failFromApi(err, values, { loginPath: ADMIN_LOGIN });
		}
		redirect(303, `/admin/roles/${role.id}`);
	}
};
