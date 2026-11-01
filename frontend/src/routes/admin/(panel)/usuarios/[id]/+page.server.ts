import type { RoleSummary, StaffUser } from '#lib/api/types.ts';
import { ADMIN_LOGIN, mfaResetAction, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError, optionalText, text } from '#lib/server/forms.ts';
import { can } from '#lib/utils/labels.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	requirePermission(locals, 'users.read');
	const id = encodeURIComponent(params.id);
	try {
		const [user, roles] = await Promise.all([
			locals.api.request<StaffUser>(`/admin/users/${id}`),
			can(locals.user, 'users.manage')
				? locals.api.request<RoleSummary[]>('/admin/users/assignable-roles')
				: Promise.resolve([] as RoleSummary[])
		]);
		return { user, roles, created: url.searchParams.has('creado') };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

const opts = { loginPath: ADMIN_LOGIN };

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		const data = await request.formData();
		const body = {
			firstName: text(data, 'firstName'),
			lastName: text(data, 'lastName'),
			phone: optionalText(data, 'phone')
		};
		try {
			await locals.api.request(`/admin/users/${encodeURIComponent(params.id)}`, {
				method: 'PATCH',
				body
			});
			return { success: 'Datos actualizados.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},

	roles: async ({ request, locals, params }) => {
		const roleIds = (await request.formData()).getAll('roleIds').map(String);
		try {
			await locals.api.request(`/admin/users/${encodeURIComponent(params.id)}/roles`, {
				method: 'PUT',
				body: { roleIds }
			});
			return { success: 'Roles actualizados.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},

	status: async ({ request, locals, params }) => {
		const status = text(await request.formData(), 'status');
		try {
			await locals.api.request(`/admin/users/${encodeURIComponent(params.id)}/status`, {
				method: 'PATCH',
				body: { status }
			});
			return { success: 'Estado actualizado.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},

	mfaReset: ({ locals, params }) =>
		mfaResetAction(locals, `/admin/users/${encodeURIComponent(params.id)}`),

	passwordReset: async ({ locals, params }) => {
		try {
			await locals.api.request(`/admin/users/${encodeURIComponent(params.id)}/password-reset`, {
				method: 'POST'
			});
			return { success: 'Se envió al usuario un enlace para definir su contraseña.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	}
};
