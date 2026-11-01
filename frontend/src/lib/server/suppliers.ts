import { text } from './forms.ts';

/** Campos de SupplierForm.svelte. En edición los vacíos se envían como null para borrarlos. */
export function supplierFromForm(data: FormData, mode: 'create' | 'update') {
	const optional = (name: string) => text(data, name) || (mode === 'update' ? null : undefined);
	return {
		name: text(data, 'name'),
		taxId: optional('taxId'),
		contactName: optional('contactName'),
		phone: optional('phone'),
		email: optional('email'),
		address: optional('address'),
		notes: optional('notes'),
		...(mode === 'update' ? { isActive: data.get('isActive') === 'on' } : {})
	};
}
