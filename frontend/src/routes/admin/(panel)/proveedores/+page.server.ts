import type { SupplierPage } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError } from '#lib/server/forms.ts';
import { supplierFromForm } from '#lib/server/suppliers.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'purchases.read');
	const search = (url.searchParams.get('search') ?? '').trim().slice(0, 100);
	const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
	const query = new URLSearchParams({ page: String(page), pageSize: '25', status: 'all' });
	if (search) query.set('search', search);
	try {
		return {
			suppliers: await locals.api.request<SupplierPage>(`/admin/suppliers?${query}`),
			search
		};
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const body = supplierFromForm(await request.formData(), 'create');
		try {
			await locals.api.request('/admin/suppliers', { method: 'POST', body });
			return { success: `Proveedor «${body.name}» agregado.` };
		} catch (err) {
			return failFromApi(err, undefined, { loginPath: ADMIN_LOGIN });
		}
	}
};
