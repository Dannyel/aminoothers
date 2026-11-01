import { fail } from '@sveltejs/kit';
import type { PasswordResetResponse } from '#lib/api/types.ts';
import { failFromApi, secret, text } from '#lib/server/forms.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => ({ token: url.searchParams.get('token') ?? '' });

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const data = await request.formData();
		const token = text(data, 'token');
		const password = secret(data, 'password');
		if (password !== secret(data, 'passwordConfirm')) {
			return fail(400, { messages: ['Las contraseñas no coinciden.'] });
		}
		try {
			const result = await locals.api.request<PasswordResetResponse>('/auth/reset-password', {
				method: 'POST',
				body: { token, password }
			});
			return {
				success: result.message,
				loginHref: result.type === 'STAFF' ? ('admin/login' as const) : ('login' as const)
			};
		} catch (err) {
			return failFromApi(err);
		}
	}
};
