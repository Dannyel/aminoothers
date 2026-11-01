import { describe, expect, it } from 'vitest';
import { guatemalaDateTime, promotionFromForm } from './promotions.ts';

describe('promotionFromForm', () => {
	it('interpreta las fechas en la hora de Guatemala', () => {
		expect(guatemalaDateTime('2027-01-01T08:30')).toBe('2027-01-01T08:30:00-06:00');
		expect(new Date(guatemalaDateTime('2027-01-01T08:30')).toISOString()).toBe(
			'2027-01-01T14:30:00.000Z'
		);
	});

	it('toma todos los productos marcados', () => {
		const data = new FormData();
		data.set('name', ' Oferta ');
		data.set('type', 'PERCENTAGE');
		data.set('value', '10');
		data.set('startsAt', '2027-01-01T00:00');
		data.set('endsAt', '2027-01-31T23:59');
		data.append('productIds', 'a');
		data.append('productIds', 'b');
		expect(promotionFromForm(data)).toMatchObject({
			name: 'Oferta',
			isActive: false,
			productIds: ['a', 'b']
		});
	});
});
