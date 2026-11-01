import { fail, redirect } from '@sveltejs/kit';
import type { Category } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError, optionalText, text } from '#lib/server/forms.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals, 'catalog.read');
	try {
		return {
			category: await locals.api.request<Category>(
				`/admin/categories/${encodeURIComponent(params.id)}`
			)
		};
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

const opts = { loginPath: ADMIN_LOGIN };
const intOrUndefined = (value: string) => (value === '' ? undefined : Number(value));

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		const data = await request.formData();
		try {
			await locals.api.request(`/admin/categories/${encodeURIComponent(params.id)}`, {
				method: 'PATCH',
				body: {
					name: text(data, 'name'),
					description: optionalText(data, 'description') ?? '',
					sortOrder: intOrUndefined(text(data, 'sortOrder')),
					isActive: data.get('isActive') === 'on'
				}
			});
			return { success: 'Categoría actualizada.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},

	image: async ({ request, locals, params }) => {
		const file = (await request.formData()).get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { messages: ['Seleccione una imagen.'] });
		}
		const body = new FormData();
		body.append('file', file, file.name);
		try {
			await locals.api.request(`/admin/categories/${encodeURIComponent(params.id)}/image`, {
				method: 'PUT',
				body
			});
			return { success: 'Imagen actualizada.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},

	removeImage: async ({ locals, params }) => {
		try {
			await locals.api.request(`/admin/categories/${encodeURIComponent(params.id)}/image`, {
				method: 'DELETE'
			});
			return { success: 'Imagen eliminada.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},

	remove: async ({ locals, params }) => {
		try {
			await locals.api.request(`/admin/categories/${encodeURIComponent(params.id)}`, {
				method: 'DELETE'
			});
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
		redirect(303, '/admin/categorias');
	},

	createSub: async ({ request, locals, params }) => {
		const name = text(await request.formData(), 'name');
		try {
			await locals.api.request(`/admin/categories/${encodeURIComponent(params.id)}/subcategories`, {
				method: 'POST',
				body: { name }
			});
			return { success: `Se agregó «${name}».` };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},

	updateSub: async ({ request, locals }) => {
		const data = await request.formData();
		const body: { name?: string; isActive?: boolean } = {};
		if (data.has('name')) body.name = text(data, 'name');
		if (data.has('isActive')) body.isActive = text(data, 'isActive') === 'true';
		try {
			await locals.api.request(`/admin/subcategories/${encodeURIComponent(text(data, 'id'))}`, {
				method: 'PATCH',
				body
			});
			return { success: 'Subcategoría actualizada.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},

	removeSub: async ({ request, locals }) => {
		const id = text(await request.formData(), 'id');
		try {
			await locals.api.request(`/admin/subcategories/${encodeURIComponent(id)}`, {
				method: 'DELETE'
			});
			return { success: 'Subcategoría eliminada.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	}
};
