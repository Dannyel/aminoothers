import type { ShippingMethodInput } from '#lib/api/types.ts';
import { text } from './forms.ts';

/** Campos de ShippingMethodForm.svelte. Los opcionales vacíos se envían como null. */
export function shippingMethodFromForm(data: FormData): ShippingMethodInput {
	const days = (name: string) => {
		const value = text(data, name);
		return value === '' ? null : Number(value);
	};
	return {
		name: text(data, 'name'),
		description: text(data, 'description') || null,
		cost: text(data, 'cost'),
		estimatedDaysMin: days('estimatedDaysMin'),
		estimatedDaysMax: days('estimatedDaysMax'),
		coverageNote: text(data, 'coverageNote') || null,
		allowsCashOnDelivery: data.get('allowsCashOnDelivery') === 'on',
		isActive: data.get('isActive') === 'on',
		courierId: text(data, 'courierId') || null,
		sortOrder: Number(text(data, 'sortOrder') || '0')
	};
}
