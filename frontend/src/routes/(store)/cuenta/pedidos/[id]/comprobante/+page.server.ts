import type { Invoice } from '#lib/api/types.ts';
import { loadError } from '#lib/server/forms.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	try {
		return {
			invoice: await locals.api.request<Invoice>(
				`/store/orders/${encodeURIComponent(params.id)}/receipt`
			)
		};
	} catch (err) {
		loadError(err);
	}
};
