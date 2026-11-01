import type { PurchaseOrderPage } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { loadError } from '#lib/server/forms.ts';
import type { PageServerLoad } from './$types';

const STATUSES = ['DRAFT', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED'];

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'purchases.read');
	const params = url.searchParams;
	const filters = {
		search: (params.get('search') ?? '').trim().slice(0, 100),
		status: STATUSES.includes(params.get('status') ?? '') ? params.get('status')! : '',
		supplierId: /^[0-9a-f-]{36}$/i.test(params.get('supplierId') ?? '')
			? params.get('supplierId')!
			: ''
	};
	const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
	const query = new URLSearchParams({ page: String(page), pageSize: '25' });
	for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
	try {
		return {
			orders: await locals.api.request<PurchaseOrderPage>(`/admin/purchase-orders?${query}`),
			filters
		};
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};
