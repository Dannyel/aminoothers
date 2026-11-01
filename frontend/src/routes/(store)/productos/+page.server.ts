import type { StoreProductPage } from '#lib/api/types.ts';
import { loadError } from '#lib/server/forms.ts';
import type { PageServerLoad } from './$types';

const SORTS = ['name', 'price_asc', 'price_desc', 'newest'] as const;
const slug = (value: string | null) => (value && /^[a-z0-9-]{1,250}$/.test(value) ? value : '');

export const load: PageServerLoad = async ({ locals, url }) => {
	const sort = url.searchParams.get('orden') ?? 'name';
	const filters = {
		q: (url.searchParams.get('q') ?? '').trim().slice(0, 100),
		categoria: slug(url.searchParams.get('categoria')),
		subcategoria: slug(url.searchParams.get('subcategoria')),
		marca: slug(url.searchParams.get('marca')),
		orden: (SORTS as readonly string[]).includes(sort) ? sort : 'name',
		page: Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
	};
	const query = new URLSearchParams({
		page: String(filters.page),
		pageSize: '24',
		sort: filters.orden
	});
	if (filters.q) query.set('search', filters.q);
	if (filters.categoria) query.set('category', filters.categoria);
	if (filters.subcategoria) query.set('subcategory', filters.subcategoria);
	if (filters.marca) query.set('brand', filters.marca);

	try {
		return {
			filters,
			products: await locals.api.request<StoreProductPage>(`/store/products?${query}`)
		};
	} catch (err) {
		loadError(err);
	}
};
