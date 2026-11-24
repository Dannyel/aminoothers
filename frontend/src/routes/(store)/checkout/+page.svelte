<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import CheckoutSteps from '#lib/components/store/CheckoutSteps.svelte';
	import OrderTotals from '#lib/components/store/OrderTotals.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
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
	const section = 'flex flex-col gap-4 border-t border-stone-200 pt-8';
	const heading = 'flex items-center gap-3 font-display text-xl font-medium text-stone-950';
	const stepNumber =
		'flex size-7 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white';
	// Opción seleccionable: el borde se oscurece cuando su radio está marcado.
	const choice =
		'flex gap-3 rounded-2xl border border-stone-200 bg-white p-4 text-sm transition-colors duration-200 hover:border-stone-400 has-checked:border-stone-900 has-checked:ring-1 has-checked:ring-stone-900';
</script>

<!-- El enlace para agregar dirección se arma sobre una ruta resuelta con resolve(). -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

<svelte:head>
	<title>Finalizar compra · {data.info.tradeName}</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
	<CheckoutSteps current={1} />
	<h1 class="mb-8 text-4xl sm:text-5xl">Finalizar compra</h1>

	<div class="mb-8 flex flex-col gap-2 empty:hidden">
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

	<div class="grid gap-10 lg:grid-cols-[1fr_24rem] lg:gap-14">
		<div class="flex flex-col gap-10">
			<fieldset class={section}>
				<legend class="sr-only">Dirección de entrega</legend>
				<h2 class={heading}><span class={stepNumber}>1</span>Dirección de entrega</h2>
				{#if data.addresses.length === 0}
					<p class="text-sm text-stone-600">Aún no tiene direcciones registradas.</p>
				{/if}
				{#each data.addresses as address (address.id)}
					<label class={choice}>
						<input
							type="radio"
							name="addressId"
							value={address.id}
							form="checkout-form"
							checked={address.id === defaultAddress}
							class="mt-0.5"
						/>
						<span>
							<span class="font-medium text-stone-950">{address.label}</span>
							<span class="block text-stone-600">
								{address.recipientName} · {address.phone}<br />
								{address.addressLine1}{address.addressLine2
									? `, ${address.addressLine2}`
									: ''}{address.zone ? `, zona ${address.zone}` : ''}, {address.municipality}, {address.department}
							</span>
						</span>
					</label>
				{/each}
				<a href={newAddress} class="btn btn-secondary min-h-10 self-start px-4"
					><Icon name="plus" class="size-4" /> Agregar una dirección</a
				>
			</fieldset>

			<form method="get" class={section}>
				<h2 class={heading}><span class={stepNumber}>2</span>Envío</h2>
				{#if data.shippingMethods.length === 0}
					<p class="text-sm text-stone-600">
						Por el momento no hay métodos de envío disponibles. Intente más tarde.
					</p>
				{/if}
				{#each data.shippingMethods as method (method.id)}
					{@const estimate = deliveryEstimate(method.estimatedDaysMin, method.estimatedDaysMax)}
					<label class={choice}>
						<input
							type="radio"
							name="envio"
							value={method.id}
							checked={method.id === shipping?.id}
							onchange={(e) => e.currentTarget.form?.requestSubmit()}
							class="mt-0.5"
						/>
						<span class="flex-1">
							<span class="flex justify-between gap-2 font-medium text-stone-900">
								{method.name}
								<span>{Number(method.cost) === 0 ? 'Gratis' : formatMoney(method.cost)}</span>
							</span>
							{#if method.description}<span class="block text-stone-600">{method.description}</span
								>{/if}
							{#if estimate}<span class="block text-stone-500">Entrega estimada: {estimate}</span
								>{/if}
							{#if method.coverageNote}<span class="block text-stone-500"
									>{method.coverageNote}</span
								>{/if}
							{#if !method.allowsCashOnDelivery}
								<span class="block text-xs text-stone-500">No admite pago contra entrega.</span>
							{/if}
						</span>
					</label>
				{/each}
				<noscript><Button type="submit" variant="secondary">Actualizar envío</Button></noscript>
			</form>

			<fieldset class={section}>
				<legend class="sr-only">Forma de pago</legend>
				<h2 class={heading}><span class={stepNumber}>3</span>Forma de pago</h2>
				<label class={choice}>
					<input
						type="radio"
						name="paymentMethod"
						value="BANK_TRANSFER"
						form="checkout-form"
						checked={payment === 'BANK_TRANSFER'}
						class="mt-0.5"
					/>
					<span>
						<span class="font-medium text-stone-950">{PAYMENT_METHOD_LABELS.BANK_TRANSFER}</span>
						<span class="block text-stone-600">
							Reservamos sus productos mientras realiza la transferencia. La farmacia verifica cada
							pago antes de preparar el pedido.
						</span>
					</span>
				</label>
				<label class="{choice} {codAllowed ? '' : 'opacity-60'}">
					<input
						type="radio"
						name="paymentMethod"
						value="CASH_ON_DELIVERY"
						form="checkout-form"
						checked={payment === 'CASH_ON_DELIVERY'}
						disabled={!codAllowed}
						class="mt-0.5"
					/>
					<span>
						<span class="font-medium text-stone-950">{PAYMENT_METHOD_LABELS.CASH_ON_DELIVERY}</span>
						<span class="block text-stone-600">
							{codAllowed
								? 'Paga en efectivo al recibir su pedido. Nuestro equipo lo confirmará antes de enviarlo.'
								: 'No disponible con el envío elegido.'}
						</span>
					</span>
				</label>
			</fieldset>

			<fieldset class={section}>
				<legend class="sr-only">Facturación y notas</legend>
				<h2 class={heading}><span class={stepNumber}>4</span>Facturación</h2>
				<div class="grid gap-3 sm:grid-cols-2">
					<label class="flex flex-col gap-1.5 text-sm">
						<span class="font-medium text-stone-800">NIT</span>
						<input
							name="billingTaxId"
							form="checkout-form"
							value={values?.billingTaxId ?? data.profile.taxId}
							maxlength={20}
						/>
						<span class="text-xs text-stone-500">Escriba CF si es consumidor final.</span>
					</label>
					<label class="flex flex-col gap-1.5 text-sm">
						<span class="font-medium text-stone-800">Nombre para facturación</span>
						<input
							name="billingName"
							form="checkout-form"
							value={values?.billingName ?? data.profile.taxName ?? ''}
							maxlength={200}
						/>
					</label>
				</div>
				<label class="flex flex-col gap-1.5 text-sm">
					<span class="font-medium text-stone-800">Indicaciones para la entrega (opcional)</span>
					<textarea name="notes" form="checkout-form" rows="2" maxlength={500}
						>{values?.notes ?? ''}</textarea
					>
				</label>
			</fieldset>
		</div>

		<aside
			class="flex h-fit flex-col gap-5 rounded-3xl bg-white p-6 ring-1 ring-stone-200 sm:p-7 lg:sticky lg:top-36"
		>
			<h2 class="text-xl">Su pedido</h2>
			<ul class="flex flex-col gap-3 border-b border-stone-200 pb-5 text-sm">
				{#each cart.lines as line (line.productId)}
					<li class="flex justify-between gap-3">
						<span class="text-stone-700"
							><span class="text-stone-500 tabular-nums">{line.quantity} ×</span> {line.name}</span
						>
						<span class="shrink-0 text-stone-950 tabular-nums">{formatMoney(line.lineTotal)}</span>
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
				<Button type="submit" size="lg" class="w-full" loading={submitting} disabled={!ready}>
					<Icon name="lock" class="size-4" />
					Confirmar pedido por {formatMoney(cart.summary.total)}
				</Button>
			</form>
			<p class="text-center text-xs text-stone-500">
				Al confirmar se reservan los productos. Precios con IVA incluido.
			</p>
			<a href={resolve('carrito')} class="link text-center text-sm">Volver al carrito</a>
		</aside>
	</div>
</div>
