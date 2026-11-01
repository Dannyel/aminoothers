import { fail, redirect } from '@sveltejs/kit';
import type { Message } from '#lib/api/types.ts';
import { failFromApi, optionalText, secret, text } from '#lib/server/forms.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, '/');
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const data = await request.formData();
		const values = {
			email: text(data, 'email'),
			firstName: text(data, 'firstName'),
			lastName: text(data, 'lastName'),
			phone: optionalText(data, 'phone')
		};
		const password = secret(data, 'password');
		if (password !== secret(data, 'passwordConfirm')) {
			return fail(400, { messages: ['Las contraseñas no coinciden.'], values });
		}
		try {
			const result = await locals.api.request<Message>('/auth/register', {
				method: 'POST',
				body: { ...values, password }
			});
			return { success: result.message };
		} catch (err) {
			return failFromApi(err, values);
		}
	}
};
