import { redirect } from '@sveltejs/kit';
import type { Supplier } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError } from '#lib/server/forms.ts';
import { supplierFromForm } from '#lib/server/suppliers.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals, 'purchases.read');
	try {
		return {
			supplier: await locals.api.request<Supplier>(
				`/admin/suppliers/${encodeURIComponent(params.id)}`
			)
		};
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

const opts = { loginPath: ADMIN_LOGIN };

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		const body = supplierFromForm(await request.formData(), 'update');
		try {
			await locals.api.request(`/admin/suppliers/${encodeURIComponent(params.id)}`, {
				method: 'PATCH',
				body
			});
			return { success: 'Proveedor actualizado.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},

	remove: async ({ locals, params }) => {
		try {
			await locals.api.request(`/admin/suppliers/${encodeURIComponent(params.id)}`, {
				method: 'DELETE'
			});
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
		redirect(303, '/admin/proveedores');
	}
};
