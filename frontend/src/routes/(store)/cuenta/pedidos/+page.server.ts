import type { OrderSummaryPage } from '#lib/api/types.ts';
import { loadError } from '#lib/server/forms.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
	try {
		return {
			orders: await locals.api.request<OrderSummaryPage>(`/store/orders?page=${page}&pageSize=20`)
		};
	} catch (err) {
		loadError(err);
	}
};
