import { text } from './forms.ts';

/** Campos de BankAccountForm.svelte. */
export function bankAccountFromForm(data: FormData) {
	return {
		bankName: text(data, 'bankName'),
		accountNumber: text(data, 'accountNumber'),
		accountType: text(data, 'accountType'),
		accountHolder: text(data, 'accountHolder'),
		instructions: text(data, 'instructions') || null,
		isActive: data.get('isActive') === 'on',
		sortOrder: Number(text(data, 'sortOrder') || '0')
	};
}

/** Campos de CourierForm.svelte. */
export function courierFromForm(data: FormData) {
	return {
		name: text(data, 'name'),
		phone: text(data, 'phone') || null,
		website: text(data, 'website') || null,
		trackingUrlTemplate: text(data, 'trackingUrlTemplate') || null,
		isActive: data.get('isActive') === 'on'
	};
}
