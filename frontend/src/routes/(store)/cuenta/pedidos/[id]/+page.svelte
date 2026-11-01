<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import OrderTotals from '#lib/components/store/OrderTotals.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ConfirmButton from '#lib/components/ui/ConfirmButton.svelte';
	import {
		formatDateTime,
		formatMoney,
		formatOrderNumber,
		ORDER_STATUS_LABELS,
		ORDER_STATUS_TONES,
		PAYMENT_METHOD_LABELS,
		PAYMENT_STATUS_LABELS,
		SHIPMENT_STATUS_LABELS
	} from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const order = $derived(data.order);
	const label = $derived(formatOrderNumber('PED', order.number));
	const isNew = $derived(page.url.searchParams.get('nuevo') === '1');
	const pending = $derived(
		order.status === 'PENDING_PAYMENT' || order.status === 'PENDING_CONFIRMATION'
	);
	const s = $derived(order.shipping);
	const values = $derived(form && 'values' in form ? form.values : undefined);
	const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(
		new Date()
	);
	let sending = $state(false);
	const field =
		'rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600';
</script>

<!-- El enlace de rastreo apunta al sitio externo de la mensajería. -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

<svelte:head>
	<title>Pedido {label} · {data.info.tradeName}</title>
</svelte:head>

<PageHeading title="Pedido {label}" description="Realizado el {formatDateTime(order.placedAt)}">
	{#snippet actions()}
		<a
			href={resolve('cuenta/pedidos')}
			class="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-200">← Mis pedidos</a
		>
	{/snippet}
</PageHeading>

<div class="flex flex-col gap-4">
	<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
	<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />
	{#if isNew}
		<Alert
			variant="success"
			messages="¡Gracias! Recibimos su pedido y le enviamos la confirmación por correo."
		/>
	{/if}

	<section
		class="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-5"
	>
		<Badge tone={ORDER_STATUS_TONES[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
		{#if pending && order.reservationExpiresAt}
			<p class="text-sm text-slate-700">
				{order.paymentMethod === 'BANK_TRANSFER'
					? 'Reservamos sus productos hasta el'
					: 'Confirmaremos su pedido antes del'}
				<strong>{formatDateTime(order.reservationExpiresAt)}</strong>. Si no se completa en ese
				plazo, el pedido se cancela automáticamente.
			</p>
		{/if}
		{#if order.status === 'PAYMENT_IN_REVIEW'}
			<p class="text-sm text-slate-700">
				Recibimos su comprobante. La farmacia verifica cada transferencia antes de preparar el
				pedido.
			</p>
		{/if}
		{#if order.cancelReason}
			<p class="text-sm text-slate-700">Motivo de la cancelación: {order.cancelReason}</p>
		{/if}
		{#if order.canCancel}
			<form method="post" action="?/cancel" class="ml-auto" use:enhance>
				<ConfirmButton
					message="¿Cancelar el pedido {label}? Los productos reservados se liberan."
					confirmLabel="Sí, cancelar"
				>
					Cancelar pedido
				</ConfirmButton>
			</form>
		{/if}
	</section>

	{#if order.canSubmitTransfer}
		<section class="flex flex-col gap-4 rounded-lg border border-teal-200 bg-white p-5">
			<h2 class="font-semibold text-slate-900">Pague por transferencia</h2>
			{#if order.paymentRejectionReason}
				<Alert
					variant="warning"
					messages="No pudimos verificar su comprobante anterior: {order.paymentRejectionReason}. Puede enviar uno nuevo."
				/>
			{/if}
			<p class="text-sm text-slate-700">
				Transfiera <strong>{formatMoney(order.total)}</strong> a una de estas cuentas y registre los datos
				de la transferencia con su comprobante.
			</p>
			{#if data.bankAccounts.length === 0}
				<Alert
					variant="warning"
					messages="Por ahora no hay cuentas disponibles. Comuníquese con la farmacia."
				/>
			{:else}
				<ul class="grid gap-3 sm:grid-cols-2">
					{#each data.bankAccounts as account (account.id)}
						<li class="rounded-md border border-slate-200 p-3 text-sm">
							<p class="font-medium text-slate-900">{account.bankName}</p>
							<p>Cuenta {account.accountType} {account.accountNumber}</p>
							<p class="text-slate-600">A nombre de {account.accountHolder}</p>
							{#if account.instructions}<p class="text-slate-500">{account.instructions}</p>{/if}
						</li>
					{/each}
				</ul>
				<form
					method="post"
					action="?/transfer"
					enctype="multipart/form-data"
					class="grid gap-3 sm:grid-cols-2"
					use:enhance={() => {
						sending = true;
						return async ({ update }) => {
							await update();
							sending = false;
						};
					}}
				>
					<label class="flex flex-col gap-1 text-sm">
						<span class="font-medium text-slate-700">Cuenta a la que transfirió</span>
						<select name="bankAccountId" required value={values?.bankAccountId ?? ''} class={field}>
							<option value="" disabled>Elija una cuenta</option>
							{#each data.bankAccounts as account (account.id)}
								<option value={account.id}>{account.bankName} · {account.accountNumber}</option>
							{/each}
						</select>
					</label>
					<label class="flex flex-col gap-1 text-sm">
						<span class="font-medium text-slate-700">Número de referencia</span>
						<input
							name="bankReference"
							required
							minlength={4}
							maxlength={50}
							pattern={'[A-Za-z0-9-]{4,50}'}
							value={values?.bankReference ?? ''}
							class={field}
						/>
					</label>
					<label class="flex flex-col gap-1 text-sm">
						<span class="font-medium text-slate-700">Fecha de la transferencia</span>
						<input
							type="date"
							name="transferDate"
							required
							max={today}
							value={values?.transferDate ?? today}
							class={field}
						/>
					</label>
					<label class="flex flex-col gap-1 text-sm">
						<span class="font-medium text-slate-700">Comprobante (imagen o PDF)</span>
						<input
							type="file"
							name="file"
							required
							accept="image/jpeg,image/png,image/webp,application/pdf"
							class="text-sm"
						/>
					</label>
					<div class="sm:col-span-2">
						<Button type="submit" loading={sending}>Enviar comprobante</Button>
					</div>
				</form>
			{/if}
		</section>
	{/if}

	{#if order.shipment}
		{@const shipment = order.shipment}
		<section class="rounded-lg border border-slate-200 bg-white p-5 text-sm">
			<h2 class="mb-2 font-semibold text-slate-900">Seguimiento del envío</h2>
			<p>
				{shipment.courierName} · {SHIPMENT_STATUS_LABELS[shipment.status]}
				{#if shipment.trackingNumber}· Guía {shipment.trackingNumber}{/if}
			</p>
			{#if shipment.trackingUrl}
				<a
					href={shipment.trackingUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="text-teal-800 hover:underline">Rastrear en el sitio de la mensajería ↗</a
				>
			{/if}
			<ol class="mt-3 flex flex-col gap-2 border-l border-slate-200 pl-4">
				{#each shipment.events as event, i (i)}
					<li>
						<p class="font-medium text-slate-800">{event.description}</p>
						<p class="text-xs text-slate-500">
							{formatDateTime(event.occurredAt)}{event.location ? ` · ${event.location}` : ''}
						</p>
					</li>
				{/each}
			</ol>
		</section>
	{/if}

	<div class="grid gap-4 md:grid-cols-2">
		<section class="rounded-lg border border-slate-200 bg-white p-5 text-sm">
			<h2 class="mb-2 font-semibold text-slate-900">Entrega</h2>
			<p>{s.recipientName} · {s.phone}</p>
			<p class="text-slate-600">
				{s.addressLine1}{s.addressLine2 ? `, ${s.addressLine2}` : ''}{s.zone
					? `, zona ${s.zone}`
					: ''},
				{s.municipality}, {s.department}
			</p>
			{#if s.reference}<p class="text-slate-500">Referencia: {s.reference}</p>{/if}
			<p class="mt-2">Envío: {s.methodName}</p>
			{#if order.customerNotes}<p class="text-slate-500">
					Indicaciones: {order.customerNotes}
				</p>{/if}
		</section>
		<section class="rounded-lg border border-slate-200 bg-white p-5 text-sm">
			<h2 class="mb-2 font-semibold text-slate-900">Pago y facturación</h2>
			<p>{PAYMENT_METHOD_LABELS[order.paymentMethod]}</p>
			{#if order.payment}
				<p class="text-slate-600">
					Estado del pago: {PAYMENT_STATUS_LABELS[order.payment.status]} · {formatMoney(
						order.payment.amount
					)}
				</p>
				{#if order.payment.bankReference}
					<p class="text-slate-500">
						{order.payment.bankName} · referencia {order.payment.bankReference}
					</p>
				{/if}
			{/if}
			<p class="mt-2">NIT {order.billingTaxId} · {order.billingName}</p>
			{#if order.receipt}
				<p class="mt-2">
					<a
						href={resolve(`cuenta/pedidos/${order.id}/comprobante`)}
						class="text-teal-800 hover:underline">Ver comprobante interno</a
					>
					{#if order.receipt.felStatus === 'CERTIFIED'}
						<span class="text-slate-500"
							>· FEL serie {order.receipt.felSeries} n.º {order.receipt.felNumber}</span
						>
					{/if}
				</p>
			{/if}
		</section>
	</div>

	<section class="rounded-lg border border-slate-200 bg-white p-5">
		<h2 class="mb-3 font-semibold text-slate-900">Productos</h2>
		<table class="min-w-full text-sm">
			<thead class="text-left text-xs text-slate-500 uppercase">
				<tr>
					<th class="py-2">Producto</th>
					<th class="py-2 text-right">Precio</th>
					<th class="py-2 text-right">Cant.</th>
					<th class="py-2 text-right">Total</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each order.items as item (item.productId)}
					<tr>
						<td class="py-2">
							{item.productName}
							<span class="block text-xs text-slate-500">
								{[item.presentationLabel, item.concentrationLabel].filter(Boolean).join(' · ')}
							</span>
						</td>
						<td class="py-2 text-right">
							{formatMoney(item.unitPrice)}
							{#if Number(item.unitDiscount) > 0}
								<span class="block text-xs text-red-700">−{formatMoney(item.unitDiscount)} c/u</span
								>
							{/if}
						</td>
						<td class="py-2 text-right">{item.quantity}</td>
						<td class="py-2 text-right">{formatMoney(item.lineTotal)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<div class="mt-4 ml-auto max-w-xs">
			<OrderTotals
				subtotal={order.subtotal}
				discountTotal={order.discountTotal}
				shippingCost={order.shippingCost}
				taxTotal={order.taxTotal}
				total={order.total}
			/>
		</div>
		<p class="mt-3 text-xs text-slate-500">Este resumen no constituye factura.</p>
	</section>

	<section class="rounded-lg border border-slate-200 bg-white p-5 text-sm">
		<h2 class="mb-2 font-semibold text-slate-900">Historial</h2>
		<ol class="flex flex-col gap-2">
			{#each order.history as entry, i (i)}
				<li class="flex flex-wrap justify-between gap-2">
					<span>
						{ORDER_STATUS_LABELS[entry.toStatus]}
						{#if entry.note}<span class="text-slate-500">· {entry.note}</span>{/if}
					</span>
					<span class="text-slate-500">{formatDateTime(entry.createdAt)}</span>
				</li>
			{/each}
		</ol>
	</section>
</div>
