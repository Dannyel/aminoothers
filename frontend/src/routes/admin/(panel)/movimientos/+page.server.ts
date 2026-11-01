import type { MovementPage } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { loadError } from '#lib/server/forms.ts';
import type { PageServerLoad } from './$types';

const TYPES = [
	'PURCHASE_RECEIPT',
	'SALE',
	'ADJUSTMENT_IN',
	'ADJUSTMENT_OUT',
	'RETURN_RESTOCK',
	'WRITE_OFF',
	'RETURN_TO_SUPPLIER'
];
const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'inventory.read');
	const params = url.searchParams;
	const pick = (name: string, valid: (v: string) => boolean) => {
		const value = (params.get(name) ?? '').trim();
		return valid(value) ? value : '';
	};
	const filters = {
		search: (params.get('search') ?? '').trim().slice(0, 100),
		type: pick('type', (v) => TYPES.includes(v)),
		from: pick('from', (v) => DATE.test(v)),
		to: pick('to', (v) => DATE.test(v)),
		productId: pick('productId', (v) => UUID.test(v))
	};
	const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
	const query = new URLSearchParams({ page: String(page), pageSize: '50' });
	for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
	try {
		return {
			movements: await locals.api.request<MovementPage>(`/admin/inventory/movements?${query}`),
			filters
		};
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};
