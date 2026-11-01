import { redirect } from '@sveltejs/kit';
import type { ProductDetail } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError } from '#lib/server/forms.ts';
import { loadProductOptions, productFromForm } from '#lib/server/products.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'products.manage');
	try {
		return { options: await loadProductOptions(locals.api) };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const body = productFromForm(await request.formData(), 'create');
		let product: ProductDetail;
		try {
			product = await locals.api.request<ProductDetail>('/admin/products', {
				method: 'POST',
				body
			});
		} catch (err) {
			return failFromApi(err, undefined, { loginPath: ADMIN_LOGIN });
		}
		redirect(303, `/admin/productos/${product.id}?creado=1`);
	}
};
