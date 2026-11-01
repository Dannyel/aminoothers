import type { BankAccount } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError } from '#lib/server/forms.ts';
import { bankAccountFromForm } from '#lib/server/settings-forms.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'settings.manage');
	try {
		return { rows: await locals.api.request<BankAccount[]>('/admin/bank-accounts') };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const body = bankAccountFromForm(await request.formData());
		try {
			await locals.api.request('/admin/bank-accounts', { method: 'POST', body });
			return { success: 'Registro agregado.' };
		} catch (err) {
			return failFromApi(err, undefined, { loginPath: ADMIN_LOGIN });
		}
	}
};
