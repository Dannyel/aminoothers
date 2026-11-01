import { redirect } from '@sveltejs/kit';
import type { RoleSummary, StaffUser } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError, optionalText, text } from '#lib/server/forms.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'users.manage');
	try {
		return { roles: await locals.api.request<RoleSummary[]>('/admin/users/assignable-roles') };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const data = await request.formData();
		const values = {
			email: text(data, 'email'),
			firstName: text(data, 'firstName'),
			lastName: text(data, 'lastName'),
			phone: optionalText(data, 'phone'),
			roleIds: data.getAll('roleIds').map(String)
		};
		let user: StaffUser;
		try {
			user = await locals.api.request<StaffUser>('/admin/users', { method: 'POST', body: values });
		} catch (err) {
			return failFromApi(err, values, { loginPath: ADMIN_LOGIN });
		}
		redirect(303, `/admin/usuarios/${user.id}?creado=1`);
	}
};
