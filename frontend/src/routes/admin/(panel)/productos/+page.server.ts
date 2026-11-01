import type { CatalogOption, Category, ProductPage } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { loadError } from '#lib/server/forms.ts';
import type { PageServerLoad } from './$types';

const UUID = /^[0-9a-f-]{36}$/i;
const SALE_CONDITIONS = ['OTC', 'PRESCRIPTION', 'RETAINED_PRESCRIPTION', 'CONTROLLED'];

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'products.read');
	const params = url.searchParams;
	const filters = {
		search: (params.get('search') ?? '').trim().slice(0, 100),
		categoryId: UUID.test(params.get('categoryId') ?? '') ? params.get('categoryId')! : '',
		brandId: UUID.test(params.get('brandId') ?? '') ? params.get('brandId')! : '',
		saleCondition: SALE_CONDITIONS.includes(params.get('saleCondition') ?? '')
			? params.get('saleCondition')!
			: '',
		status: ['active', 'inactive'].includes(params.get('status') ?? '')
			? params.get('status')!
			: 'all',
		onlineSale: ['yes', 'no'].includes(params.get('onlineSale') ?? '')
			? params.get('onlineSale')!
			: 'all'
	};
	const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
	const query = new URLSearchParams({ page: String(page), pageSize: '25' });
	for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);

	try {
		const [result, categories, brands] = await Promise.all([
			locals.api.request<ProductPage>(`/admin/products?${query}`),
			locals.api.request<Category[]>('/admin/categories'),
			locals.api.request<CatalogOption[]>('/admin/catalog/brands/options')
		]);
		return { result, filters, categories, brands };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};
