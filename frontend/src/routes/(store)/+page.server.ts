import type { StoreProductPage } from '#lib/api/types.ts';
import { loadError } from '#lib/server/forms.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		return {
			latest: await locals.api.request<StoreProductPage>('/store/products?sort=newest&pageSize=8')
		};
	} catch (err) {
		loadError(err);
	}
};
