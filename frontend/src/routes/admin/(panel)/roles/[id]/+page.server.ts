import { redirect } from '@sveltejs/kit';
import type { Permission, Role } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError, optionalText, text } from '#lib/server/forms.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals, 'roles.read');
	try {
		const [role, permissions] = await Promise.all([
			locals.api.request<Role>(`/admin/roles/${encodeURIComponent(params.id)}`),
			locals.api.request<Permission[]>('/admin/permissions')
		]);
		return { role, permissions };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

const opts = { loginPath: ADMIN_LOGIN };

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		const data = await request.formData();
		const body = {
			name: text(data, 'name'),
			description: optionalText(data, 'description') ?? '',
			permissions: data.getAll('permissions').map(String)
		};
		try {
			await locals.api.request(`/admin/roles/${encodeURIComponent(params.id)}`, {
				method: 'PATCH',
				body
			});
			return { success: 'Rol actualizado.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},

	remove: async ({ locals, params }) => {
		try {
			await locals.api.request(`/admin/roles/${encodeURIComponent(params.id)}`, {
				method: 'DELETE'
			});
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
		redirect(303, '/admin/roles');
	}
};
