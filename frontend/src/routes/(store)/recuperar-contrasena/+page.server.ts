import type { Message } from '#lib/api/types.ts';
import { failFromApi, text } from '#lib/server/forms.ts';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const email = text(await request.formData(), 'email');
		try {
			const result = await locals.api.request<Message>('/auth/forgot-password', {
				method: 'POST',
				body: { email }
			});
			return { success: result.message };
		} catch (err) {
			return failFromApi(err, { email });
		}
	}
};
