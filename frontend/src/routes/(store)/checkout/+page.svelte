<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import OrderTotals from '#lib/components/store/OrderTotals.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { deliveryEstimate, formatMoney, PAYMENT_METHOD_LABELS } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const cart = $derived(data.cart);
	const shipping = $derived(data.shipping);
	const values = $derived(form?.values);
	const defaultAddress = $derived(
		values?.addressId ?? data.addresses.find((a) => a.isDefault)?.id ?? data.addresses[0]?.id
	);
	const codAllowed = $derived(shipping?.allowsCashOnDelivery ?? false);
	const payment = $derived(
		values?.paymentMethod === 'CASH_ON_DELIVERY' && codAllowed
			? 'CASH_ON_DELIVERY'
			: 'BANK_TRANSFER'
	);
	const ready = $derived(
		cart.canCheckout && shipping !== null && data.addresses.length > 0 && data.profile.emailVerified
	);
	let submitting = $state(false);
	const newAddress = `${resolve('cuenta/direcciones/nueva')}?volver=${encodeURIComponent('/checkout')}`;
	const field =
		'rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600';
	const section = 'flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5';
</script>

<!-- El enlace para agregar dirección se arma sobre una ruta resuelta con resolve(). -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

<svelte:head>
	<title>Finalizar compra · {data.info.tradeName}</title>
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-8">
	<PageHeading title="Finalizar compra" />

	<div class="mb-4 flex flex-col gap-2">
		<Alert variant="error" messages={form?.messages} />
		{#if !data.profile.emailVerified}
			<Alert
				variant="warning"
				messages="Confirme su correo electrónico para realizar pedidos. Puede reenviar el enlace desde su perfil."
			/>
		{/if}
		{#if !cart.canCheckout}
			<Alert
				variant="warning"
				messages="Algunos productos de su carrito ya no se pueden comprar como están. Revíselos en el carrito."
			/>
		{/if}
	</div>

	<div class="grid gap-6 lg:grid-cols-[1fr_340px]">
		<div class="flex flex-col gap-4">
			<fieldset class={section}>
				<legend class="sr-only">Dirección de entrega</legend>
				<h2 class="font-semibold text-slate-900">1. Dirección de entrega</h2>
				{#if data.addresses.length === 0}
					<p class="text-sm text-slate-600">Aún no tiene direcciones registradas.</p>
				{/if}
				{#each data.addresses as address (address.id)}
					<label
						class="flex gap-3 rounded-md border border-slate-200 p-3 text-sm has-checked:border-teal-600"
					>
						<input
							type="radio"
							name="addressId"
							value={address.id}
							form="checkout-form"
							checked={address.id === defaultAddress}
							class="mt-1 text-teal-700 focus:ring-teal-600"
						/>
						<span>
							<span class="font-medium text-slate-900">{address.label}</span>
							<span class="block text-slate-600">
								{address.recipientName} · {address.phone}<br />
								{address.addressLine1}{address.addressLine2
									? `, ${address.addressLine2}`
									: ''}{address.zone ? `, zona ${address.zone}` : ''}, {address.municipality}, {address.department}
							</span>
						</span>
					</label>
				{/each}
				<a href={newAddress} class="text-sm text-teal-800 hover:underline"
					>+ Agregar una dirección</a
				>
			</fieldset>

			<form method="get" class={section}>
				<h2 class="font-semibold text-slate-900">2. Envío</h2>
				{#if data.shippingMethods.length === 0}
					<p class="text-sm text-slate-600">
						Por el momento no hay métodos de envío disponibles. Intente más tarde.
					</p>
				{/if}
				{#each data.shippingMethods as method (method.id)}
					{@const estimate = deliveryEstimate(method.estimatedDaysMin, method.estimatedDaysMax)}
					<label
						class="flex gap-3 rounded-md border border-slate-200 p-3 text-sm has-checked:border-teal-600"
					>
						<input
							type="radio"
							name="envio"
							value={method.id}
							checked={method.id === shipping?.id}
							onchange={(e) => e.currentTarget.form?.requestSubmit()}
							class="mt-1 text-teal-700 focus:ring-teal-600"
						/>
						<span class="flex-1">
							<span class="flex justify-between gap-2 font-medium text-slate-900">
								{method.name}
								<span>{Number(method.cost) === 0 ? 'Gratis' : formatMoney(method.cost)}</span>
							</span>
							{#if method.description}<span class="block text-slate-600">{method.description}</span
								>{/if}
							{#if estimate}<span class="block text-slate-500">Entrega estimada: {estimate}</span
								>{/if}
							{#if method.coverageNote}<span class="block text-slate-500"
									>{method.coverageNote}</span
								>{/if}
							{#if !method.allowsCashOnDelivery}
								<span class="block text-xs text-slate-500">No admite pago contra entrega.</span>
							{/if}
						</span>
					</label>
				{/each}
				<noscript><Button type="submit" variant="secondary">Actualizar envío</Button></noscript>
			</form>

			<fieldset class={section}>
				<legend class="sr-only">Forma de pago</legend>
				<h2 class="font-semibold text-slate-900">3. Forma de pago</h2>
				<label
					class="flex gap-3 rounded-md border border-slate-200 p-3 text-sm has-checked:border-teal-600"
				>
					<input
						type="radio"
						name="paymentMethod"
						value="BANK_TRANSFER"
						form="checkout-form"
						checked={payment === 'BANK_TRANSFER'}
						class="mt-1 text-teal-700 focus:ring-teal-600"
					/>
					<span>
						<span class="font-medium text-slate-900">{PAYMENT_METHOD_LABELS.BANK_TRANSFER}</span>
						<span class="block text-slate-600">
							Reservamos sus productos mientras realiza la transferencia. La farmacia verifica cada
							pago antes de preparar el pedido.
						</span>
					</span>
				</label>
				<label
					class="flex gap-3 rounded-md border border-slate-200 p-3 text-sm has-checked:border-teal-600 {codAllowed
						? ''
						: 'opacity-60'}"
				>
					<input
						type="radio"
						name="paymentMethod"
						value="CASH_ON_DELIVERY"
						form="checkout-form"
						checked={payment === 'CASH_ON_DELIVERY'}
						disabled={!codAllowed}
						class="mt-1 text-teal-700 focus:ring-teal-600"
					/>
					<span>
						<span class="font-medium text-slate-900">{PAYMENT_METHOD_LABELS.CASH_ON_DELIVERY}</span>
						<span class="block text-slate-600">
							{codAllowed
								? 'Paga en efectivo al recibir su pedido. Nuestro equipo lo confirmará antes de enviarlo.'
								: 'No disponible con el envío elegido.'}
						</span>
					</span>
				</label>
			</fieldset>

			<fieldset class={section}>
				<legend class="sr-only">Facturación y notas</legend>
				<h2 class="font-semibold text-slate-900">4. Facturación</h2>
				<div class="grid gap-3 sm:grid-cols-2">
					<label class="flex flex-col gap-1 text-sm">
						<span class="font-medium text-slate-700">NIT</span>
						<input
							name="billingTaxId"
							form="checkout-form"
							value={values?.billingTaxId ?? data.profile.taxId}
							maxlength={20}
							class={field}
						/>
						<span class="text-xs text-slate-500">Escriba CF si es consumidor final.</span>
					</label>
					<label class="flex flex-col gap-1 text-sm">
						<span class="font-medium text-slate-700">Nombre para facturación</span>
						<input
							name="billingName"
							form="checkout-form"
							value={values?.billingName ?? data.profile.taxName ?? ''}
							maxlength={200}
							class={field}
						/>
					</label>
				</div>
				<label class="flex flex-col gap-1 text-sm">
					<span class="font-medium text-slate-700">Indicaciones para la entrega (opcional)</span>
					<textarea name="notes" form="checkout-form" rows="2" maxlength={500} class={field}
						>{values?.notes ?? ''}</textarea
					>
				</label>
			</fieldset>
		</div>

		<aside class="flex h-fit flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5">
			<h2 class="font-semibold text-slate-900">Su pedido</h2>
			<ul class="flex flex-col gap-2 text-sm">
				{#each cart.lines as line (line.productId)}
					<li class="flex justify-between gap-3">
						<span class="text-slate-700">{line.quantity} × {line.name}</span>
						<span class="shrink-0">{formatMoney(line.lineTotal)}</span>
					</li>
				{/each}
			</ul>
			<OrderTotals {...cart.summary} />
			<form
				id="checkout-form"
				method="post"
				action="?/place"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update({ reset: false });
						submitting = false;
					};
				}}
			>
				<input type="hidden" name="shippingMethodId" value={shipping?.id ?? ''} />
				<input type="hidden" name="expectedTotal" value={cart.summary.total} />
				<input type="hidden" name="idempotencyKey" value={data.idempotencyKey} />
				<Button type="submit" class="w-full" loading={submitting} disabled={!ready}>
					Confirmar pedido por {formatMoney(cart.summary.total)}
				</Button>
			</form>
			<p class="text-xs text-slate-500">
				Al confirmar se reservan los productos. Precios con IVA incluido.
			</p>
			<a href={resolve('carrito')} class="text-center text-sm text-teal-800 hover:underline"
				>Volver al carrito</a
			>
		</aside>
	</div>
</div>
