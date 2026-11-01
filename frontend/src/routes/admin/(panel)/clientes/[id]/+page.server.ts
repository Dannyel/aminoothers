import type { CustomerDetail } from '#lib/api/types.ts';
import { ADMIN_LOGIN, mfaResetAction, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError, text } from '#lib/server/forms.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals, 'customers.read');
	try {
		return {
			customer: await locals.api.request<CustomerDetail>(
				`/admin/customers/${encodeURIComponent(params.id)}`
			)
		};
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

export const actions: Actions = {
	mfaReset: ({ locals, params }) =>
		mfaResetAction(locals, `/admin/customers/${encodeURIComponent(params.id)}`),

	status: async ({ request, locals, params }) => {
		const status = text(await request.formData(), 'status');
		try {
			await locals.api.request(`/admin/customers/${encodeURIComponent(params.id)}/status`, {
				method: 'PATCH',
				body: { status }
			});
			return { success: 'Estado actualizado.' };
		} catch (err) {
			return failFromApi(err, undefined, { loginPath: ADMIN_LOGIN });
		}
	}
};
