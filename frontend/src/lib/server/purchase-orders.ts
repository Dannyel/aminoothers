import type { ProductOption, SupplierPage } from '#lib/api/types.ts';
import type { ApiClient } from './api.ts';
import { optionalText, text } from './forms.ts';

/** Proveedores activos y productos para el formulario de orden de compra. */
export async function loadOrderFormOptions(api: ApiClient) {
	const [suppliers, products] = await Promise.all([
		api.request<SupplierPage>('/admin/suppliers?status=active&pageSize=100'),
		api.request<ProductOption[]>('/admin/products/options')
	]);
	return { suppliers: suppliers.items, products };
}

/** Las líneas llegan como campos repetidos (productId, quantity, unitCost) en orden. */
export function orderFromForm(data: FormData) {
	const productIds = data.getAll('productId').map(String);
	const quantities = data.getAll('quantity').map(String);
	const costs = data.getAll('unitCost').map(String);
	return {
		supplierId: text(data, 'supplierId'),
		expectedDate: optionalText(data, 'expectedDate') ?? null,
		notes: optionalText(data, 'notes') ?? null,
		items: productIds.map((productId, i) => ({
			productId,
			quantity: Number(quantities[i]),
			unitCost: (costs[i] ?? '').trim().replace(',', '.')
		}))
	};
}

/** Líneas de recepción: campos repetidos por fila (una fila por lote recibido). */
export function receiptFromForm(data: FormData) {
	const field = (name: string) => data.getAll(name).map((v) => String(v).trim());
	const itemIds = field('purchaseOrderItemId');
	const lotNumbers = field('lotNumber');
	const expirations = field('expirationDate');
	const quantities = field('quantity');
	const costs = field('unitCost');
	const statuses = field('initialStatus');
	return {
		supplierInvoiceNumber: optionalText(data, 'supplierInvoiceNumber'),
		notes: optionalText(data, 'notes'),
		// Las filas con cantidad vacía o cero no se reciben.
		items: itemIds
			.map((purchaseOrderItemId, i) => ({
				purchaseOrderItemId,
				lotNumber: lotNumbers[i],
				expirationDate: expirations[i] || undefined,
				quantity: Number(quantities[i] || 0),
				unitCost: costs[i]?.replace(',', '.') || undefined,
				initialStatus: statuses[i] || undefined
			}))
			.filter((item) => item.quantity > 0)
	};
}
