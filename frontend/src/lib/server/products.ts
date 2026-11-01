import type { CatalogOption, Category, SaleCondition, TaxRate } from '#lib/api/types.ts';
import type { ApiClient } from './api.ts';
import { text } from './forms.ts';

export interface ProductFormOptions {
	categories: Category[];
	brands: CatalogOption[];
	manufacturers: CatalogOption[];
	presentations: CatalogOption[];
	concentrations: CatalogOption[];
	activeIngredients: CatalogOption[];
	tags: CatalogOption[];
	taxRates: TaxRate[];
}

/** Opciones de los selectores del formulario de producto. */
export async function loadProductOptions(api: ApiClient): Promise<ProductFormOptions> {
	const option = (kind: string) => api.request<CatalogOption[]>(`/admin/catalog/${kind}/options`);
	const [
		categories,
		brands,
		manufacturers,
		presentations,
		concentrations,
		activeIngredients,
		tags,
		taxRates
	] = await Promise.all([
		api.request<Category[]>('/admin/categories'),
		option('brands'),
		option('manufacturers'),
		option('presentations'),
		option('concentrations'),
		option('active-ingredients'),
		option('tags'),
		api.request<TaxRate[]>('/admin/tax-rates')
	]);
	return {
		categories: categories.filter((c) => c.isActive),
		brands,
		manufacturers,
		presentations,
		concentrations,
		activeIngredients,
		tags,
		taxRates
	};
}

/**
 * Datos del formulario de producto (ProductForm.svelte). En edición los campos
 * opcionales vacíos se envían como null para poder borrarlos.
 */
export function productFromForm(data: FormData, mode: 'create' | 'update') {
	const optional = (name: string) => text(data, name) || (mode === 'update' ? null : undefined);
	const threshold = text(data, 'lowStockThreshold');
	const body = {
		name: text(data, 'name'),
		barcode: optional('barcode'),
		shortDescription: optional('shortDescription'),
		description: optional('description'),
		categoryId: text(data, 'categoryId'),
		subcategoryId: optional('subcategoryId'),
		brandId: optional('brandId'),
		manufacturerId: optional('manufacturerId'),
		presentationId: optional('presentationId'),
		concentrationId: optional('concentrationId'),
		activeIngredientIds: data.getAll('activeIngredientIds').map(String),
		tagIds: data.getAll('tagIds').map(String),
		sanitaryRegistration: optional('sanitaryRegistration'),
		sanitaryRegistrationExpiresAt: optional('sanitaryRegistrationExpiresAt'),
		price: text(data, 'price').replace(',', '.'),
		taxRateId: text(data, 'taxRateId') || undefined,
		saleCondition: text(data, 'saleCondition') as SaleCondition,
		lowStockThreshold: threshold === '' ? undefined : Number(threshold),
		isActive: data.get('isActive') === 'on'
	};
	return mode === 'create' ? { ...body, sku: text(data, 'sku') } : body;
}
