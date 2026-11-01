import { error, redirect } from '@sveltejs/kit';
import type { Courier } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError } from '#lib/server/forms.ts';
import { courierFromForm } from '#lib/server/settings-forms.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals, 'settings.manage');
	let rows: Courier[];
	try {
		rows = await locals.api.request<Courier[]>('/admin/couriers');
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
	const row = rows.find((r) => r.id === params.id);
	if (!row) error(404, 'No encontrado');
	return { row };
};

const opts = { loginPath: ADMIN_LOGIN };

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		const body = courierFromForm(await request.formData());
		try {
			await locals.api.request(`/admin/couriers/${encodeURIComponent(params.id)}`, {
				method: 'PATCH',
				body
			});
			return { success: 'Cambios guardados.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},

	remove: async ({ locals, params }) => {
		try {
			await locals.api.request(`/admin/couriers/${encodeURIComponent(params.id)}`, {
				method: 'DELETE'
			});
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
		redirect(303, '/admin/mensajerias');
	}
};
