<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import OrderTotals from '#lib/components/store/OrderTotals.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ConfirmButton from '#lib/components/ui/ConfirmButton.svelte';
	import {
		can,
		DISPOSITION_LABELS,
		formatDate,
		formatDateTime,
		formatMoney,
		formatOrderNumber,
		ORDER_STATUS_LABELS,
		ORDER_STATUS_TONES,
		PAYMENT_METHOD_LABELS,
		PAYMENT_STATUS_LABELS,
		PAYMENT_STATUS_TONES,
		REFUND_METHOD_LABELS,
		REFUND_STATUS_LABELS,
		REFUND_STATUS_TONES,
		RETURN_STATUS_LABELS,
		RETURN_STATUS_TONES,
		SHIPMENT_STATUS_LABELS
	} from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const order = $derived(data.order);
	const label = $derived(formatOrderNumber('PED', order.number));
	const has = (action: (typeof data.order.actions)[number]) => order.actions.includes(action);
	const allowed = (permission: string) => can(data.staff, permission);
	const isCod = $derived(order.paymentMethod === 'CASH_ON_DELIVERY');
	const s = $derived(order.shipping);
	const keep =
		() =>
		async ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) =>
			update({ reset: true });
	const field =
		'rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600';
	const box = 'flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 text-sm';
	const proofPath = (paymentId: string) => resolve(`admin/pagos/${paymentId}/comprobante`);
</script>

<!-- Los enlaces de rastreo apuntan al sitio externo de la mensajería. -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

<PageHeading title="Pedido {label}" description="Realizado el {formatDateTime(order.placedAt)}">
	{#snippet actions()}
		<a
			href={resolve('admin/pedidos')}
			class="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-200">← Pedidos</a
		>
	{/snippet}
</PageHeading>

<div class="flex flex-col gap-4">
	<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
	<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />

	<section class="{box} sm:flex-row sm:flex-wrap sm:items-center">
		<Badge tone={ORDER_STATUS_TONES[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
		<span>{PAYMENT_METHOD_LABELS[order.paymentMethod]} · {formatMoney(order.total)}</span>
		{#if order.reservationExpiresAt && ['PENDING_PAYMENT', 'PENDING_CONFIRMATION'].includes(order.status)}
			<span class="text-slate-600">Reserva hasta {formatDateTime(order.reservationExpiresAt)}</span>
		{/if}
		{#if order.cancelReason}
			<span class="text-slate-600">
				Cancelado: {order.cancelReason}{order.cancelledBy ? ` (${order.cancelledBy.name})` : ''}
			</span>
		{/if}
	</section>

	<!-- Acciones del flujo según el estado y los permisos. -->
	{#if order.actions.length > 0}
		<section class="{box} gap-4">
			<h2 class="font-semibold text-slate-900">Acciones</h2>
			<div class="flex flex-wrap gap-3">
				{#if has('confirm') && allowed('orders.manage')}
					<form method="post" action="?/confirm" use:enhance>
						<Button type="submit">Confirmar pedido contra entrega</Button>
					</form>
				{/if}
				{#if has('prepare') && allowed('orders.manage')}
					<form method="post" action="?/prepare" use:enhance>
						<Button type="submit">Pasar a preparación</Button>
					</form>
				{/if}
			</div>

			{#if has('dispatch') && allowed('shipments.manage')}
				<form
					method="post"
					action="?/dispatch"
					class="grid gap-3 sm:grid-cols-4 sm:items-end"
					use:enhance={keep}
				>
					<label class="flex flex-col gap-1">
						<span class="font-medium text-slate-700">Mensajería</span>
						<select name="courierId" required class={field}>
							{#each data.couriers as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
						</select>
					</label>
					<label class="flex flex-col gap-1">
						<span class="font-medium text-slate-700">Número de guía</span>
						<input name="trackingNumber" maxlength={100} class={field} />
					</label>
					<label class="flex flex-col gap-1">
						<span class="font-medium text-slate-700">Costo de la mensajería (Q)</span>
						<input
							name="courierCost"
							inputmode="decimal"
							pattern={'\\d{1,10}(\\.\\d{1,2})?'}
							class={field}
						/>
					</label>
					<Button type="submit" disabled={data.couriers.length === 0}>Despachar</Button>
					{#if data.couriers.length === 0}
						<p class="text-amber-800 sm:col-span-4">
							Registre una mensajería activa para despachar.
						</p>
					{/if}
					<p class="text-xs text-slate-500 sm:col-span-4">
						Al despachar se descuentan del inventario los lotes reservados.
					</p>
				</form>
			{/if}

			{#if has('addEvent') && allowed('shipments.manage')}
				<form
					method="post"
					action="?/event"
					class="grid gap-3 sm:grid-cols-4 sm:items-end"
					use:enhance={keep}
				>
					<label class="flex flex-col gap-1">
						<span class="font-medium text-slate-700">Seguimiento</span>
						<select name="status" class={field}>
							<option value="IN_TRANSIT">En tránsito</option>
							<option value="DISPATCHED">Despachado</option>
						</select>
					</label>
					<label class="flex flex-col gap-1">
						<span class="font-medium text-slate-700">Descripción</span>
						<input name="description" required maxlength={300} class={field} />
					</label>
					<label class="flex flex-col gap-1">
						<span class="font-medium text-slate-700">Ubicación</span>
						<input name="location" maxlength={150} class={field} />
					</label>
					<Button type="submit" variant="secondary">Agregar evento</Button>
				</form>
			{/if}

			{#if has('deliver') && allowed('shipments.manage') && (!isCod || allowed('payments.collect'))}
				<form
					method="post"
					action="?/deliver"
					class="grid gap-3 sm:grid-cols-4 sm:items-end"
					use:enhance={keep}
				>
					<label class="flex flex-col gap-1">
						<span class="font-medium text-slate-700">Recibió</span>
						<input name="receivedByName" maxlength={150} class={field} />
					</label>
					{#if isCod}
						<label class="flex flex-col gap-1">
							<span class="font-medium text-slate-700">Monto cobrado (Q)</span>
							<input
								name="collectedAmount"
								required
								value={order.total}
								inputmode="decimal"
								pattern={'\\d{1,10}(\\.\\d{1,2})?'}
								class={field}
							/>
						</label>
					{/if}
					<label class="flex flex-col gap-1">
						<span class="font-medium text-slate-700"
							>Nota{isCod ? ' (obligatoria si el cobro difiere)' : ''}</span
						>
						<input name="note" maxlength={500} class={field} />
					</label>
					<Button type="submit">Registrar entrega</Button>
				</form>
			{/if}

			{#if has('fail') && allowed('shipments.manage')}
				<form
					method="post"
					action="?/fail"
					class="flex flex-wrap items-end gap-3"
					use:enhance={keep}
				>
					<label class="flex flex-1 flex-col gap-1">
						<span class="font-medium text-slate-700">Motivo de la entrega fallida</span>
						<input name="note" required maxlength={500} class={field} />
					</label>
					<Button type="submit" variant="secondary">Entrega fallida</Button>
				</form>
			{/if}

			{#if has('redispatch') && allowed('shipments.manage')}
				<form
					method="post"
					action="?/redispatch"
					class="flex flex-wrap items-end gap-3"
					use:enhance={keep}
				>
					<label class="flex flex-col gap-1">
						<span class="font-medium text-slate-700">Nueva guía (opcional)</span>
						<input name="trackingNumber" maxlength={100} class={field} />
					</label>
					<label class="flex flex-1 flex-col gap-1">
						<span class="font-medium text-slate-700">Nota</span>
						<input name="note" maxlength={500} class={field} />
					</label>
					<Button type="submit">Reintentar entrega</Button>
				</form>
			{/if}

			{#if has('returnToStore') && allowed('shipments.manage')}
				<form
					method="post"
					action="?/returnToStore"
					class="flex flex-wrap items-end gap-3"
					use:enhance={keep}
				>
					<label class="flex flex-1 flex-col gap-1">
						<span class="font-medium text-slate-700">El paquete volvió a la farmacia</span>
						<input name="note" required maxlength={500} class={field} />
					</label>
					<Button type="submit" variant="secondary">Registrar devolución del paquete</Button>
				</form>
			{/if}

			{#if has('cancel') && allowed('orders.manage')}
				<form
					method="post"
					action="?/cancel"
					class="flex flex-wrap items-end gap-3"
					use:enhance={keep}
				>
					<label class="flex flex-1 flex-col gap-1">
						<span class="font-medium text-slate-700">Motivo de la cancelación</span>
						<input name="reason" required maxlength={500} class={field} />
					</label>
					<ConfirmButton
						message="¿Cancelar el pedido {label}? Se liberan las reservas."
						confirmLabel="Cancelar pedido"
					>
						Cancelar pedido
					</ConfirmButton>
				</form>
			{/if}
		</section>
	{/if}

	<div class="grid gap-4 md:grid-cols-2">
		<section class={box}>
			<h2 class="font-semibold text-slate-900">Cliente y entrega</h2>
			<p>
				{order.customerName} · {order.customerEmail}{order.customerPhone
					? ` · ${order.customerPhone}`
					: ''}
			</p>
			<p>NIT {order.billingTaxId} · {order.billingName}</p>
			{#if order.receipt}
				<p>
					<a
						href={resolve(`admin/facturacion/${order.receipt.id}`)}
						class="text-teal-800 hover:underline"
						>Comprobante {formatOrderNumber('CI', order.receipt.number)}</a
					>
					· {order.receipt.status === 'VOIDED'
						? 'anulado'
						: order.receipt.felStatus === 'CERTIFIED'
							? `FEL ${order.receipt.felSeries}-${order.receipt.felNumber}`
							: 'FEL pendiente'}
				</p>
			{/if}
			<p class="text-slate-600">
				{s.recipientName} · {s.phone}<br />
				{s.addressLine1}{s.addressLine2 ? `, ${s.addressLine2}` : ''}{s.zone
					? `, zona ${s.zone}`
					: ''},
				{s.municipality}, {s.department}
			</p>
			{#if s.reference}<p class="text-slate-500">Referencia: {s.reference}</p>{/if}
			{#if order.customerNotes}<p class="text-slate-500">
					Indicaciones: {order.customerNotes}
				</p>{/if}
			<p>Envío: {s.methodName} ({formatMoney(s.cost)})</p>
		</section>

		<section class={box}>
			<h2 class="font-semibold text-slate-900">Envío</h2>
			{#if order.adminShipment}
				{@const sh = order.adminShipment}
				<p>
					{sh.courierName} · {SHIPMENT_STATUS_LABELS[sh.status]}{sh.trackingNumber
						? ` · Guía ${sh.trackingNumber}`
						: ''}
				</p>
				{#if sh.trackingUrl}
					<a
						href={sh.trackingUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="text-teal-800 hover:underline">Rastrear ↗</a
					>
				{/if}
				{#if sh.courierCost}<p class="text-slate-500">
						Costo de la mensajería: {formatMoney(sh.courierCost)}
					</p>{/if}
				<ol class="flex flex-col gap-1 border-l border-slate-200 pl-3">
					{#each sh.events as e, i (i)}
						<li>
							{e.description}
							<span class="text-xs text-slate-500"
								>· {formatDateTime(e.occurredAt)}{e.location ? ` · ${e.location}` : ''}</span
							>
						</li>
					{/each}
				</ol>
			{:else}
				<p class="text-slate-500">Aún no se despacha.</p>
			{/if}
		</section>
	</div>

	<section class={box}>
		<h2 class="font-semibold text-slate-900">Productos y lotes</h2>
		<table class="min-w-full text-sm">
			<thead class="text-left text-xs text-slate-500 uppercase">
				<tr>
					<th class="py-2">Producto</th>
					<th class="py-2 text-right">Precio</th>
					<th class="py-2 text-right">Cant.</th>
					<th class="py-2 text-right">Devueltas</th>
					<th class="py-2 text-right">Total</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each order.items as item (item.id)}
					<tr>
						<td class="py-2">
							{item.productName} <span class="text-xs text-slate-500">{item.sku}</span>
							<ul class="text-xs text-slate-500">
								{#each order.reservations.filter((r) => r.orderItemId === item.id) as r (r.lotId)}
									<li>
										Lote {r.lotNumber} (vence {formatDate(r.expirationDate)}): {r.quantity} · {r.status}
									</li>
								{/each}
							</ul>
						</td>
						<td class="py-2 text-right">{formatMoney(item.unitPrice)}</td>
						<td class="py-2 text-right">{item.quantity}</td>
						<td class="py-2 text-right">{item.quantityReturned}</td>
						<td class="py-2 text-right">{formatMoney(item.lineTotal)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<div class="ml-auto w-full max-w-xs">
			<OrderTotals
				subtotal={order.subtotal}
				discountTotal={order.discountTotal}
				shippingCost={order.shippingCost}
				taxTotal={order.taxTotal}
				total={order.total}
			/>
		</div>
	</section>

	<section class={box}>
		<h2 class="font-semibold text-slate-900">Pagos</h2>
		{#each order.payments as p (p.id)}
			<div class="flex flex-col gap-2 rounded-md border border-slate-200 p-3">
				<div class="flex flex-wrap items-center gap-2">
					<Badge tone={PAYMENT_STATUS_TONES[p.status]}>{PAYMENT_STATUS_LABELS[p.status]}</Badge>
					<span>{PAYMENT_METHOD_LABELS[p.method]} · {formatMoney(p.amount)}</span>
					<span class="text-xs text-slate-500">{formatDateTime(p.createdAt)}</span>
				</div>
				{#if p.bankAccount}
					<p>
						{p.bankAccount.bankName}
						{p.bankAccount.accountNumber} · referencia {p.bankReference} · {formatDate(
							p.transferDate
						)}
					</p>
				{/if}
				{#if p.hasProof && allowed('payments.verify')}
					<a
						href={proofPath(p.id)}
						target="_blank"
						rel="noopener"
						class="text-teal-800 hover:underline"
						>Ver comprobante ({p.proofMimeType === 'application/pdf' ? 'PDF' : 'imagen'}) ↗</a
					>
				{/if}
				{#if p.rejectionReason}<p class="text-red-700">Rechazado: {p.rejectionReason}</p>{/if}
				{#if p.verifiedBy}<p class="text-slate-500">
						Verificó {p.verifiedBy.name} · {formatDateTime(p.verifiedAt)}
					</p>{/if}
				{#if p.collectedAmount}
					<p>
						Cobrado {formatMoney(p.collectedAmount)} por {p.collectedBy?.name} · {formatDateTime(
							p.collectedAt
						)}
						{#if p.collectionNote}<span class="text-slate-500">· {p.collectionNote}</span>{/if}
					</p>
				{/if}

				{#if p.status === 'IN_REVIEW' && allowed('payments.verify')}
					<div class="flex flex-wrap items-end gap-3">
						<form method="post" action="?/approvePayment" use:enhance>
							<input type="hidden" name="paymentId" value={p.id} />
							<Button type="submit">Aprobar transferencia</Button>
						</form>
						<form
							method="post"
							action="?/rejectPayment"
							class="flex flex-1 flex-wrap items-end gap-2"
							use:enhance={keep}
						>
							<input type="hidden" name="paymentId" value={p.id} />
							<label class="flex flex-1 flex-col gap-1">
								<span class="font-medium text-slate-700">Motivo del rechazo</span>
								<input name="reason" required maxlength={500} class={field} />
							</label>
							<Button type="submit" variant="danger">Rechazar</Button>
						</form>
					</div>
				{/if}

				{#if p.refunds.length > 0}
					<ul class="flex flex-col gap-2">
						{#each p.refunds as r (r.id)}
							<li class="flex flex-wrap items-center gap-2">
								<Badge tone={REFUND_STATUS_TONES[r.status]}>{REFUND_STATUS_LABELS[r.status]}</Badge>
								<span
									>Reembolso {formatMoney(r.amount)} · {REFUND_METHOD_LABELS[r.method]} · {r.reason}</span
								>
								{#if r.reference}<span class="text-slate-500">Ref. {r.reference}</span>{/if}
								{#if r.status === 'PENDING' && allowed('refunds.manage')}
									<form
										method="post"
										action="?/completeRefund"
										class="flex items-end gap-2"
										use:enhance={keep}
									>
										<input type="hidden" name="refundId" value={r.id} />
										<input
											name="reference"
											required
											maxlength={100}
											placeholder="Referencia"
											class={field}
										/>
										<Button type="submit" variant="secondary">Completar</Button>
									</form>
									<form method="post" action="?/cancelRefund" use:enhance>
										<input type="hidden" name="refundId" value={r.id} />
										<Button type="submit" variant="ghost">Anular</Button>
									</form>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}

				{#if Number(p.refundableAmount) > 0 && allowed('refunds.manage')}
					<form
						method="post"
						action="?/createRefund"
						class="grid gap-2 sm:grid-cols-5 sm:items-end"
						use:enhance={keep}
					>
						<input type="hidden" name="paymentId" value={p.id} />
						<label class="flex flex-col gap-1">
							<span class="font-medium text-slate-700"
								>Reembolsar (máx. {formatMoney(p.refundableAmount)})</span
							>
							<input
								name="amount"
								required
								inputmode="decimal"
								pattern={'\\d{1,10}(\\.\\d{1,2})?'}
								class={field}
							/>
						</label>
						<label class="flex flex-col gap-1">
							<span class="font-medium text-slate-700">Medio</span>
							<select name="method" class={field}>
								<option value="BANK_TRANSFER">Transferencia</option>
								<option value="CASH">Efectivo</option>
							</select>
						</label>
						<label class="flex flex-col gap-1">
							<span class="font-medium text-slate-700">Devolución</span>
							<select name="returnId" class={field}>
								<option value="">Ninguna</option>
								{#each order.returns as ret (ret.id)}
									<option value={ret.id}>DEV-{ret.number} ({formatMoney(ret.amount)})</option>
								{/each}
							</select>
						</label>
						<label class="flex flex-col gap-1">
							<span class="font-medium text-slate-700">Motivo</span>
							<input name="reason" required maxlength={500} class={field} />
						</label>
						<Button type="submit" variant="secondary">Registrar reembolso</Button>
					</form>
				{/if}
			</div>
		{/each}
	</section>

	<section class={box}>
		<h2 class="font-semibold text-slate-900">Devoluciones</h2>
		{#if order.returnDeadline}
			<p class="text-slate-500">
				Plazo para registrar devoluciones: hasta el {formatDate(order.returnDeadline)}.
			</p>
		{/if}
		{#each order.returns as ret (ret.id)}
			<div class="flex flex-wrap items-center gap-2">
				<a
					href={resolve(`admin/devoluciones/${ret.id}`)}
					class="font-medium text-teal-800 hover:underline">DEV-{ret.number}</a
				>
				<Badge tone={RETURN_STATUS_TONES[ret.status]}>{RETURN_STATUS_LABELS[ret.status]}</Badge>
				<span>{ret.reason} · {formatMoney(ret.amount)}</span>
				<span class="text-xs text-slate-500">
					{ret.items
						.map((i) => `${i.quantity} × ${i.productName} (${DISPOSITION_LABELS[i.disposition]})`)
						.join('; ')}
				</span>
			</div>
		{:else}
			<p class="text-slate-500">Sin devoluciones.</p>
		{/each}
		{#if has('createReturn') && allowed('returns.manage')}
			<form
				method="post"
				action="?/createReturn"
				class="flex flex-col gap-3 border-t border-slate-100 pt-3"
				use:enhance={keep}
			>
				<h3 class="font-medium text-slate-800">Registrar devolución</h3>
				{#each order.items.filter((i) => i.quantityReturned < i.quantity) as item (item.id)}
					<label class="flex items-center gap-3">
						<input type="hidden" name="orderItemId" value={item.id} />
						<input
							type="number"
							name="quantity"
							min={0}
							max={item.quantity - item.quantityReturned}
							value={0}
							class="{field} w-20"
						/>
						<span>{item.productName} (hasta {item.quantity - item.quantityReturned})</span>
					</label>
				{/each}
				<input name="reason" required maxlength={500} placeholder="Motivo" class={field} />
				<input name="notes" maxlength={1000} placeholder="Notas (opcional)" class={field} />
				<p class="text-xs text-slate-500">
					Las unidades devueltas no vuelven al inventario hasta que el regente las inspeccione.
				</p>
				<div><Button type="submit" variant="secondary">Registrar devolución</Button></div>
			</form>
		{/if}
	</section>

	<section class={box}>
		<h2 class="font-semibold text-slate-900">Historial</h2>
		<ol class="flex flex-col gap-1">
			{#each order.history as h, i (i)}
				<li class="flex flex-wrap justify-between gap-2">
					<span>{ORDER_STATUS_LABELS[h.toStatus]}{h.note ? ` · ${h.note}` : ''}</span>
					<span class="text-slate-500">{formatDateTime(h.createdAt)}</span>
				</li>
			{/each}
		</ol>
	</section>
</div>
