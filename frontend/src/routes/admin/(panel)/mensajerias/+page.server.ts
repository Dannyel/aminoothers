import type { Courier } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError } from '#lib/server/forms.ts';
import { courierFromForm } from '#lib/server/settings-forms.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'settings.manage');
	try {
		return { rows: await locals.api.request<Courier[]>('/admin/couriers') };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const body = courierFromForm(await request.formData());
		try {
			await locals.api.request('/admin/couriers', { method: 'POST', body });
			return { success: 'Registro agregado.' };
		} catch (err) {
			return failFromApi(err, undefined, { loginPath: ADMIN_LOGIN });
		}
	}
};
