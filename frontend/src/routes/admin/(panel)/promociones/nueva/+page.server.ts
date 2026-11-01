import { redirect } from '@sveltejs/kit';
import type { ProductOption, Promotion } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError } from '#lib/server/forms.ts';
import { promotionFromForm } from '#lib/server/promotions.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'promotions.manage');
	try {
		return { products: await locals.api.request<ProductOption[]>('/admin/products/options') };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const body = promotionFromForm(await request.formData());
		let created: Promotion;
		try {
			created = await locals.api.request<Promotion>('/admin/promotions', { method: 'POST', body });
		} catch (err) {
			return failFromApi(err, undefined, { loginPath: ADMIN_LOGIN });
		}
		redirect(303, `/admin/promociones/${created.id}`);
	}
};
