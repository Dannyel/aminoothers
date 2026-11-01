import type { StoreProductDetail } from '#lib/api/types.ts';
import { takeFlash } from '#lib/server/flash.ts';
import { loadError } from '#lib/server/forms.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, cookies }) => {
	try {
		return {
			flash: takeFlash(cookies),
			product: await locals.api.request<StoreProductDetail>(
				`/store/products/${encodeURIComponent(params.slug)}`
			)
		};
	} catch (err) {
		loadError(err);
	}
};
