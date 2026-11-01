import { redirect } from '@sveltejs/kit';
import type { ProductOption, Promotion } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError } from '#lib/server/forms.ts';
import { promotionFromForm } from '#lib/server/promotions.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals, 'promotions.read');
	try {
		const [promotion, products] = await Promise.all([
			locals.api.request<Promotion>(`/admin/promotions/${encodeURIComponent(params.id)}`),
			locals.api.request<ProductOption[]>('/admin/products/options').catch(() => [])
		]);
		return { promotion, products };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

const opts = { loginPath: ADMIN_LOGIN };

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		const body = promotionFromForm(await request.formData());
		try {
			await locals.api.request(`/admin/promotions/${encodeURIComponent(params.id)}`, {
				method: 'PATCH',
				body
			});
			return { success: 'Promoción actualizada.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},
	remove: async ({ locals, params }) => {
		try {
			await locals.api.request(`/admin/promotions/${encodeURIComponent(params.id)}`, {
				method: 'DELETE'
			});
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
		redirect(303, '/admin/promociones');
	}
};
