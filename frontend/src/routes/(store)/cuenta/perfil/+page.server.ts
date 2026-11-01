import type { CustomerProfile, Message } from '#lib/api/types.ts';
import { failFromApi, loadError, optionalText, text } from '#lib/server/forms.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		return { profile: await locals.api.request<CustomerProfile>('/store/profile') };
	} catch (err) {
		loadError(err);
	}
};

export const actions: Actions = {
	update: async ({ request, locals }) => {
		const data = await request.formData();
		const body = {
			firstName: text(data, 'firstName'),
			lastName: text(data, 'lastName'),
			phone: optionalText(data, 'phone'),
			taxId: text(data, 'taxId') || 'CF',
			taxName: optionalText(data, 'taxName'),
			birthDate: optionalText(data, 'birthDate')
		};
		try {
			await locals.api.request('/store/profile', { method: 'PATCH', body });
			return { success: 'Sus datos fueron actualizados.' };
		} catch (err) {
			return failFromApi(err);
		}
	},

	resendVerification: async ({ locals }) => {
		try {
			const result = await locals.api.request<Message>('/auth/resend-verification', {
				method: 'POST'
			});
			return { success: result.message };
		} catch (err) {
			return failFromApi(err);
		}
	}
};
