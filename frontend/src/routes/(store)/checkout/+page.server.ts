import { fail, redirect } from '@sveltejs/kit';
import type {
	Address,
	Cart,
	CustomerProfile,
	OrderDetail,
	PaymentMethod,
	ShippingMethod
} from '#lib/api/types.ts';
import { failFromApi, loadError, optionalText, text } from '#lib/server/forms.ts';
import type { Actions, PageServerLoad } from './$types';

const LOGIN = `/login?redirectTo=${encodeURIComponent('/checkout')}`;
const PAYMENT_METHODS: PaymentMethod[] = ['BANK_TRANSFER', 'CASH_ON_DELIVERY'];

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user?.type !== 'CUSTOMER') redirect(303, LOGIN);
	try {
		const [addresses, shippingMethods, profile] = await Promise.all([
			locals.api.request<Address[]>('/store/addresses'),
			locals.api.request<ShippingMethod[]>('/store/shipping-methods'),
			locals.api.request<CustomerProfile>('/store/profile')
		]);
		const requested = url.searchParams.get('envio');
		const shipping = shippingMethods.find((m) => m.id === requested) ?? shippingMethods[0] ?? null;
		const cart = await locals.api.request<Cart>(
			shipping ? `/store/cart?shippingMethodId=${shipping.id}` : '/store/cart'
		);
		if (cart.lines.length === 0) redirect(303, '/carrito');
		return {
			addresses,
			shippingMethods,
			shipping,
			profile,
			cart,
			// Un intento de compra por página mostrada: reenviar el mismo formulario
			// (doble clic, red lenta) no duplica el pedido.
			idempotencyKey: crypto.randomUUID()
		};
	} catch (err) {
		loadError(err, LOGIN);
	}
};

export const actions: Actions = {
	place: async ({ request, locals }) => {
		const data = await request.formData();
		const paymentMethod = text(data, 'paymentMethod') as PaymentMethod;
		const values = {
			addressId: text(data, 'addressId'),
			shippingMethodId: text(data, 'shippingMethodId'),
			paymentMethod: PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : undefined,
			billingTaxId: optionalText(data, 'billingTaxId'),
			billingName: optionalText(data, 'billingName'),
			notes: optionalText(data, 'notes'),
			expectedTotal: text(data, 'expectedTotal')
		};
		if (!values.addressId) {
			return fail(400, { messages: ['Elija la dirección de entrega.'], values });
		}
		let order: OrderDetail;
		try {
			order = await locals.api.request<OrderDetail>('/store/orders', {
				method: 'POST',
				body: values,
				headers: { 'Idempotency-Key': text(data, 'idempotencyKey') }
			});
		} catch (err) {
			return failFromApi(err, values, { loginPath: LOGIN });
		}
		redirect(303, `/cuenta/pedidos/${order.id}?nuevo=1`);
	}
};
