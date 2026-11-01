import { error, redirect } from '@sveltejs/kit';
import type { BankAccount } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError } from '#lib/server/forms.ts';
import { bankAccountFromForm } from '#lib/server/settings-forms.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals, 'settings.manage');
	let rows: BankAccount[];
	try {
		rows = await locals.api.request<BankAccount[]>('/admin/bank-accounts');
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
	const row = rows.find((r) => r.id === params.id);
	if (!row) error(404, 'No encontrado');
	return { row };
};

const opts = { loginPath: ADMIN_LOGIN };

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		const body = bankAccountFromForm(await request.formData());
		try {
			await locals.api.request(`/admin/bank-accounts/${encodeURIComponent(params.id)}`, {
				method: 'PATCH',
				body
			});
			return { success: 'Cambios guardados.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},

	remove: async ({ locals, params }) => {
		try {
			await locals.api.request(`/admin/bank-accounts/${encodeURIComponent(params.id)}`, {
				method: 'DELETE'
			});
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
		redirect(303, '/admin/cuentas-bancarias');
	}
};
