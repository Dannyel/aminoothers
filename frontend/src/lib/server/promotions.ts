import type { PromotionType } from '#lib/api/types.ts';
import { text } from './forms.ts';

/** "2027-01-01T08:00" (hora de Guatemala, de un input datetime-local) → ISO con zona. */
export function guatemalaDateTime(value: string): string {
	return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00-06:00` : value;
}

/** Campos de PromotionForm.svelte. */
export function promotionFromForm(data: FormData) {
	return {
		name: text(data, 'name'),
		description: text(data, 'description') || null,
		type: text(data, 'type') as PromotionType,
		value: text(data, 'value'),
		startsAt: guatemalaDateTime(text(data, 'startsAt')),
		endsAt: guatemalaDateTime(text(data, 'endsAt')),
		isActive: data.get('isActive') === 'on',
		productIds: data.getAll('productIds').map(String)
	};
}
