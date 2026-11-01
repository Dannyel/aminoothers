import type { AddressInput } from '#lib/api/types.ts';
import { optionalText, text } from './forms.ts';

/** Campos del formulario de dirección (AddressForm.svelte). */
export function addressFromForm(data: FormData): AddressInput {
	return {
		label: text(data, 'label'),
		recipientName: text(data, 'recipientName'),
		phone: text(data, 'phone'),
		addressLine1: text(data, 'addressLine1'),
		addressLine2: optionalText(data, 'addressLine2'),
		zone: optionalText(data, 'zone'),
		municipality: text(data, 'municipality'),
		department: text(data, 'department') as AddressInput['department'],
		reference: optionalText(data, 'reference'),
		isDefault: data.get('isDefault') === 'on'
	};
}
