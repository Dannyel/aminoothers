import type { Address } from '#lib/api/types.ts';
import { failFromApi, loadError, text } from '#lib/server/forms.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		return { addresses: await locals.api.request<Address[]>('/store/addresses') };
	} catch (err) {
		loadError(err);
	}
};

export const actions: Actions = {
	setDefault: async ({ request, locals }) => {
		const id = text(await request.formData(), 'id');
		try {
			await locals.api.request(`/store/addresses/${encodeURIComponent(id)}/default`, {
				method: 'POST'
			});
			return { success: 'Dirección predeterminada actualizada.' };
		} catch (err) {
			return failFromApi(err);
		}
	},

	remove: async ({ request, locals }) => {
		const id = text(await request.formData(), 'id');
		try {
			await locals.api.request(`/store/addresses/${encodeURIComponent(id)}`, {
				method: 'DELETE'
			});
			return { success: 'Dirección eliminada.' };
		} catch (err) {
			return failFromApi(err);
		}
	}
};
