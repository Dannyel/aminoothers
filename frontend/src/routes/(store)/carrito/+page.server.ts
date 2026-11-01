import { redirect } from '@sveltejs/kit';
import type { Cart } from '#lib/api/types.ts';
import { setFlash, takeFlash } from '#lib/server/flash.ts';
import { apiMessages, failFromApi, loadError, text } from '#lib/server/forms.ts';
import { ApiError } from '#lib/server/api.ts';
import { safeRedirectPath } from '#lib/server/session.ts';
import type { Actions, PageServerLoad } from './$types';

const loginFor = (path: string) => `/login?redirectTo=${encodeURIComponent(path)}`;

export const load: PageServerLoad = async ({ locals, cookies }) => {
	if (locals.user?.type !== 'CUSTOMER') redirect(303, loginFor('/carrito'));
	try {
		return { cart: await locals.api.request<Cart>('/store/cart'), flash: takeFlash(cookies) };
	} catch (err) {
		loadError(err, loginFor('/carrito'));
	}
};

const quantityOf = (data: FormData) => Number.parseInt(text(data, 'quantity'), 10);

export const actions: Actions = {
	/** Desde la página del producto: vuelve a ella con el resultado. */
	add: async ({ request, locals, cookies }) => {
		const data = await request.formData();
		const back = safeRedirectPath(text(data, 'redirectTo'), '/carrito');
		if (locals.user?.type !== 'CUSTOMER') redirect(303, loginFor(back));
		try {
			await locals.api.request('/store/cart/items', {
				method: 'POST',
				body: { productId: text(data, 'productId'), quantity: quantityOf(data) }
			});
			setFlash(cookies, { type: 'success', message: 'Producto agregado al carrito.' });
		} catch (err) {
			if (!(err instanceof ApiError)) throw err;
			if (err.status === 401) redirect(303, loginFor(back));
			setFlash(cookies, {
				type: 'error',
				message:
					err.status >= 500
						? 'No se pudo agregar el producto. Intente de nuevo.'
						: apiMessages(err).join(' ')
			});
		}
		redirect(303, back);
	},

	update: async ({ request, locals }) => {
		const data = await request.formData();
		try {
			await locals.api.request(`/store/cart/items/${encodeURIComponent(text(data, 'productId'))}`, {
				method: 'PATCH',
				body: { quantity: quantityOf(data) }
			});
		} catch (err) {
			return failFromApi(err, undefined, { loginPath: loginFor('/carrito') });
		}
	},

	remove: async ({ request, locals }) => {
		const data = await request.formData();
		try {
			await locals.api.request(`/store/cart/items/${encodeURIComponent(text(data, 'productId'))}`, {
				method: 'DELETE'
			});
		} catch (err) {
			return failFromApi(err, undefined, { loginPath: loginFor('/carrito') });
		}
	}
};
