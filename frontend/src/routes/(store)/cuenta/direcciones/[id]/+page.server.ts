import { error, redirect } from '@sveltejs/kit';
import type { Address } from '#lib/api/types.ts';
import { addressFromForm } from '#lib/server/addresses.ts';
import { failFromApi, loadError } from '#lib/server/forms.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	try {
		const [addresses, departments] = await Promise.all([
			locals.api.request<Address[]>('/store/addresses'),
			locals.api.request<string[]>('/store/departments')
		]);
		const address = addresses.find((a) => a.id === params.id);
		if (!address) error(404, 'Dirección no encontrada');
		return { address, departments };
	} catch (err) {
		loadError(err);
	}
};

export const actions: Actions = {
	default: async ({ request, locals, params }) => {
		// isDefault se cambia desde el listado; la API no lo acepta al editar.
		const values = addressFromForm(await request.formData());
		delete values.isDefault;
		try {
			await locals.api.request(`/store/addresses/${encodeURIComponent(params.id)}`, {
				method: 'PATCH',
				body: values
			});
		} catch (err) {
			return failFromApi(err, values);
		}
		redirect(303, '/cuenta/direcciones');
	}
};
