import type { Courier, ShippingMethod } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError } from '#lib/server/forms.ts';
import { shippingMethodFromForm } from '#lib/server/shipping-methods.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'settings.manage');
	try {
		const [methods, couriers] = await Promise.all([
			locals.api.request<ShippingMethod[]>('/admin/shipping-methods'),
			locals.api.request<Courier[]>('/admin/couriers')
		]);
		return { methods, couriers };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const body = shippingMethodFromForm(await request.formData());
		try {
			await locals.api.request('/admin/shipping-methods', { method: 'POST', body });
			return { success: `Método «${body.name}» agregado.` };
		} catch (err) {
			return failFromApi(err, undefined, { loginPath: ADMIN_LOGIN });
		}
	}
};
