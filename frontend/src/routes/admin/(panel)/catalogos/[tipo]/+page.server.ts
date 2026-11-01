import { error } from '@sveltejs/kit';
import type { SimpleCatalogPage } from '#lib/api/types.ts';
import { simpleCatalog } from '#lib/catalogs.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError, text } from '#lib/server/forms.ts';
import type { Actions, PageServerLoad } from './$types';

function catalogFor(tipo: string) {
	const catalog = simpleCatalog(tipo);
	if (!catalog) error(404, 'Catálogo no encontrado');
	return catalog;
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	requirePermission(locals, 'catalog.read');
	const catalog = catalogFor(params.tipo);
	const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
	const search = (url.searchParams.get('search') ?? '').trim().slice(0, 100);
	const statusParam = url.searchParams.get('status') ?? 'active';
	const status = ['active', 'inactive', 'all'].includes(statusParam) ? statusParam : 'active';
	const query = new URLSearchParams({ page: String(page), pageSize: '25', status });
	if (search) query.set('search', search);
	try {
		const result = await locals.api.request<SimpleCatalogPage>(
			`/admin/catalog/${catalog.kind}?${query}`
		);
		return { catalog, result, search, status };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

const opts = { loginPath: ADMIN_LOGIN };

export const actions: Actions = {
	create: async ({ request, locals, params }) => {
		const catalog = catalogFor(params.tipo);
		const name = text(await request.formData(), 'name');
		try {
			await locals.api.request(`/admin/catalog/${catalog.kind}`, {
				method: 'POST',
				body: { name }
			});
			return { success: `Se agregó «${name}».` };
		} catch (err) {
			return failFromApi(err, { name }, opts);
		}
	},

	update: async ({ request, locals, params }) => {
		const catalog = catalogFor(params.tipo);
		const data = await request.formData();
		const id = text(data, 'id');
		const body: { name?: string; isActive?: boolean } = {};
		if (data.has('name')) body.name = text(data, 'name');
		if (data.has('isActive')) body.isActive = text(data, 'isActive') === 'true';
		try {
			await locals.api.request(`/admin/catalog/${catalog.kind}/${encodeURIComponent(id)}`, {
				method: 'PATCH',
				body
			});
			return { success: 'Cambios guardados.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},

	remove: async ({ request, locals, params }) => {
		const catalog = catalogFor(params.tipo);
		const id = text(await request.formData(), 'id');
		try {
			await locals.api.request(`/admin/catalog/${catalog.kind}/${encodeURIComponent(id)}`, {
				method: 'DELETE'
			});
			return { success: 'Eliminado.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	}
};
