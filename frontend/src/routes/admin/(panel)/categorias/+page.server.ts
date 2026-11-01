import { redirect } from '@sveltejs/kit';
import type { Category } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError, optionalText, text } from '#lib/server/forms.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'catalog.read');
	try {
		return { categories: await locals.api.request<Category[]>('/admin/categories') };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const data = await request.formData();
		const values = { name: text(data, 'name'), description: optionalText(data, 'description') };
		let category: Category;
		try {
			category = await locals.api.request<Category>('/admin/categories', {
				method: 'POST',
				body: values
			});
		} catch (err) {
			return failFromApi(err, values, { loginPath: ADMIN_LOGIN });
		}
		redirect(303, `/admin/categorias/${category.id}`);
	}
};
