import { redirect } from '@sveltejs/kit';
import { addressFromForm } from '#lib/server/addresses.ts';
import { failFromApi, loadError } from '#lib/server/forms.ts';
import { safeRedirectPath } from '#lib/server/session.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		return { departments: await locals.api.request<string[]>('/store/departments') };
	} catch (err) {
		loadError(err);
	}
};

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		const values = addressFromForm(await request.formData());
		try {
			await locals.api.request('/store/addresses', { method: 'POST', body: values });
		} catch (err) {
			return failFromApi(err, values);
		}
		// Desde el checkout se vuelve a él con la dirección nueva.
		redirect(303, safeRedirectPath(url.searchParams.get('volver'), '/cuenta/direcciones'));
	}
};
