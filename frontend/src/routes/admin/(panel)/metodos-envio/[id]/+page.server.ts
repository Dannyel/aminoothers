import { error, redirect } from '@sveltejs/kit';
import type { Courier, ShippingMethod } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError } from '#lib/server/forms.ts';
import { shippingMethodFromForm } from '#lib/server/shipping-methods.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals, 'settings.manage');
	let methods: ShippingMethod[];
	let couriers: Courier[];
	try {
		[methods, couriers] = await Promise.all([
			locals.api.request<ShippingMethod[]>('/admin/shipping-methods'),
			locals.api.request<Courier[]>('/admin/couriers')
		]);
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
	const method = methods.find((m) => m.id === params.id);
	if (!method) error(404, 'Método de envío no encontrado');
	return { method, couriers };
};

const opts = { loginPath: ADMIN_LOGIN };

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		const body = shippingMethodFromForm(await request.formData());
		try {
			await locals.api.request(`/admin/shipping-methods/${encodeURIComponent(params.id)}`, {
				method: 'PATCH',
				body
			});
			return { success: 'Método de envío actualizado.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},

	remove: async ({ locals, params }) => {
		try {
			await locals.api.request(`/admin/shipping-methods/${encodeURIComponent(params.id)}`, {
				method: 'DELETE'
			});
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
		redirect(303, '/admin/metodos-envio');
	}
};
