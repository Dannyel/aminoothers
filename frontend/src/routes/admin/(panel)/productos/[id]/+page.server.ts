import { fail, redirect } from '@sveltejs/kit';
import type { ProductDetail } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError, text } from '#lib/server/forms.ts';
import { loadProductOptions, productFromForm } from '#lib/server/products.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	requirePermission(locals, 'products.read');
	try {
		const [product, options] = await Promise.all([
			locals.api.request<ProductDetail>(`/admin/products/${encodeURIComponent(params.id)}`),
			loadProductOptions(locals.api)
		]);
		return { product, options, created: url.searchParams.has('creado') };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

const opts = { loginPath: ADMIN_LOGIN };
const path = (id: string, suffix = '') => `/admin/products/${encodeURIComponent(id)}${suffix}`;

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		const body = productFromForm(await request.formData(), 'update');
		try {
			await locals.api.request(path(params.id), { method: 'PATCH', body });
			return { success: 'Producto actualizado.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},

	onlineSale: async ({ request, locals, params }) => {
		const enabled = text(await request.formData(), 'enabled') === 'true';
		try {
			await locals.api.request(path(params.id, '/online-sale'), {
				method: 'PUT',
				body: { enabled }
			});
			return {
				success: enabled ? 'Venta en línea habilitada.' : 'Venta en línea deshabilitada.'
			};
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},

	addImage: async ({ request, locals, params }) => {
		const data = await request.formData();
		const file = data.get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { messages: ['Seleccione una imagen.'] });
		}
		const body = new FormData();
		body.append('file', file, file.name);
		const altText = text(data, 'altText');
		if (altText) body.append('altText', altText);
		try {
			await locals.api.request(path(params.id, '/images'), { method: 'POST', body });
			return { success: 'Imagen agregada.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},

	setPrimary: async ({ request, locals, params }) => {
		const imageId = text(await request.formData(), 'imageId');
		try {
			await locals.api.request(path(params.id, `/images/${encodeURIComponent(imageId)}`), {
				method: 'PATCH',
				body: { isPrimary: true }
			});
			return { success: 'Imagen principal actualizada.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},

	moveImage: async ({ request, locals, params }) => {
		const data = await request.formData();
		const order = text(data, 'order').split(',').filter(Boolean);
		try {
			await locals.api.request(path(params.id, '/images/order'), {
				method: 'PUT',
				body: { imageIds: order }
			});
			return { success: 'Orden actualizado.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},

	removeImage: async ({ request, locals, params }) => {
		const imageId = text(await request.formData(), 'imageId');
		try {
			await locals.api.request(path(params.id, `/images/${encodeURIComponent(imageId)}`), {
				method: 'DELETE'
			});
			return { success: 'Imagen eliminada.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},

	remove: async ({ locals, params }) => {
		try {
			await locals.api.request(path(params.id), { method: 'DELETE' });
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
		redirect(303, '/admin/productos');
	}
};
