import type { Message } from '#lib/api/types.ts';
import { failFromApi, text } from '#lib/server/forms.ts';
import type { Actions, PageServerLoad } from './$types';

// La confirmación se hace con un botón (POST) y no al abrir el enlace, porque
// algunos clientes de correo abren los enlaces automáticamente para revisarlos.
export const load: PageServerLoad = ({ url }) => ({ token: url.searchParams.get('token') ?? '' });

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const token = text(await request.formData(), 'token');
		try {
			const result = await locals.api.request<Message>('/auth/verify-email', {
				method: 'POST',
				body: { token }
			});
			return { success: result.message };
		} catch (err) {
			return failFromApi(err);
		}
	}
};
