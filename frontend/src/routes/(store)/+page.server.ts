import type { StoreProductPage } from '#lib/api/types.ts';
import { loadError } from '#lib/server/forms.ts';
import type { PageServerLoad } from './$types';

/**
 * La API no tiene un filtro de ofertas: se toman los 48 productos más recientes (el máximo
 * por página) y de ellos salen las novedades y las ofertas vigentes que la API ya calcula.
 */
export const load: PageServerLoad = async ({ locals }) => {
	try {
		const recent = await locals.api.request<StoreProductPage>(
			'/store/products?sort=newest&pageSize=48'
		);
		return {
			latest: recent.items.slice(0, 8),
			offers: recent.items.filter((p) => p.promotion !== null).slice(0, 4),
			total: recent.total
		};
	} catch (err) {
		loadError(err);
	}
};
