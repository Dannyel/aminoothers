import type { StoreCategory, StoreInfo } from '#lib/api/types.ts';
import { loadError } from '#lib/server/forms.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const isCustomer = locals.user?.type === 'CUSTOMER';
	try {
		const [info, categories, cartCount] = await Promise.all([
			locals.api.request<StoreInfo>('/store/info'),
			locals.api.request<StoreCategory[]>('/store/categories'),
			isCustomer
				? locals.api
						.request<{ count: number }>('/store/cart/count')
						.then((r) => r.count)
						.catch(() => 0)
				: Promise.resolve(0)
		]);
		return { info, categories, cartCount };
	} catch (err) {
		loadError(err);
	}
};
