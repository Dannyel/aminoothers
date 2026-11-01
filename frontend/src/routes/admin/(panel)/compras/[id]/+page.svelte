<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ReceiptForm from '#lib/components/admin/ReceiptForm.svelte';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import ConfirmButton from '#lib/components/ui/ConfirmButton.svelte';
	import {
		can,
		formatDate,
		formatDateTime,
		formatMoney,
		formatOrderNumber,
		LOT_STATUS_LABELS,
		PURCHASE_ORDER_STATUS_LABELS,
		PURCHASE_ORDER_STATUS_TONES
	} from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const order = $derived(data.order);
	const canManage = $derived(can(data.staff, 'purchases.manage'));
	const canApprove = $derived(can(data.staff, 'purchases.approve'));
	const canReceive = $derived(can(data.staff, 'purchases.receive'));
	const receivable = $derived(order.status === 'APPROVED' || order.status === 'PARTIALLY_RECEIVED');
</script>

<PageHeading title={formatOrderNumber('OC', order.number)} description={order.supplier.name}>
	{#snippet actions()}
		{#if order.status === 'DRAFT' && canManage}
			<a
				href={resolve(`admin/compras/${order.id}/editar`)}
				class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
				>Editar</a
			>
		{/if}
		<a
			href={resolve('admin/compras')}
			class="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-200">← Volver</a
		>
	{/snippet}
</PageHeading>

<div class="flex flex-col gap-6">
	<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
	<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />

	<section
		class="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-lg border border-slate-200 bg-white p-5 text-sm"
	>
		<Badge tone={PURCHASE_ORDER_STATUS_TONES[order.status]}
			>{PURCHASE_ORDER_STATUS_LABELS[order.status]}</Badge
		>
		<span>Fecha: {formatDate(order.orderDate)}</span>
		<span>Esperada: {formatDate(order.expectedDate)}</span>
		<span>Creada por {order.createdBy.name}</span>
		{#if order.approvedBy}<span
				>Aprobada por {order.approvedBy.name} ({formatDateTime(order.approvedAt)})</span
			>{/if}
		{#if order.notes}<span class="w-full text-slate-600">{order.notes}</span>{/if}
	</section>

	{#if canApprove}
		<div class="flex flex-wrap gap-2">
			{#if order.status === 'DRAFT'}
				<form method="post" action="?/approve" use:enhance>
					<ConfirmButton
						variant="primary"
						message="¿Aprobar la orden? Ya no podrá editarse."
						confirmLabel="Aprobar"
					>
						Aprobar
					</ConfirmButton>
				</form>
			{/if}
			{#if order.status === 'DRAFT' || order.status === 'APPROVED'}
				<form method="post" action="?/cancel" use:enhance>
					<ConfirmButton message="¿Cancelar la orden de compra?" confirmLabel="Cancelar orden">
						Cancelar orden
					</ConfirmButton>
				</form>
			{/if}
			{#if order.status === 'PARTIALLY_RECEIVED'}
				<form method="post" action="?/close" use:enhance>
					<ConfirmButton
						variant="secondary"
						message="Se cerrará la orden y el faltante ya no se esperará. ¿Continuar?"
						confirmLabel="Cerrar">Cerrar con faltante</ConfirmButton
					>
				</form>
			{/if}
		</div>
	{/if}

	<section class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead
				class="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
			>
				<tr>
					<th class="px-4 py-3">Producto</th>
					<th class="px-4 py-3 text-right">Pedido</th>
					<th class="px-4 py-3 text-right">Recibido</th>
					<th class="px-4 py-3 text-right">Costo unit.</th>
					<th class="px-4 py-3 text-right">Subtotal</th>
					<th class="px-4 py-3 text-right">IVA</th>
					<th class="px-4 py-3 text-right">Total</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each order.items as item (item.id)}
					<tr>
						<td class="px-4 py-3"
							>{item.product.name}
							<p class="text-slate-500">{item.product.sku}</p></td
						>
						<td class="px-4 py-3 text-right">{item.quantityOrdered}</td>
						<td class="px-4 py-3 text-right">{item.quantityReceived}</td>
						<td class="px-4 py-3 text-right">Q{item.unitCost}</td>
						<td class="px-4 py-3 text-right">{formatMoney(item.lineSubtotal)}</td>
						<td class="px-4 py-3 text-right">{formatMoney(item.lineTax)}</td>
						<td class="px-4 py-3 text-right">{formatMoney(item.lineTotal)}</td>
					</tr>
				{/each}
			</tbody>
			<tfoot class="bg-slate-50 text-sm font-medium">
				<tr>
					<td class="px-4 py-3" colspan="4">Totales</td>
					<td class="px-4 py-3 text-right">{formatMoney(order.subtotal)}</td>
					<td class="px-4 py-3 text-right">{formatMoney(order.taxTotal)}</td>
					<td class="px-4 py-3 text-right">{formatMoney(order.total)}</td>
				</tr>
			</tfoot>
		</table>
	</section>

	{#if receivable && canReceive}
		<section class="rounded-lg border border-slate-200 bg-white p-6">
			<h2 class="mb-4 font-medium text-slate-900">Registrar recepción</h2>
			<ReceiptForm {order} />
		</section>
	{/if}

	{#if order.receipts.length > 0}
		<section class="flex flex-col gap-3">
			<h2 class="font-medium text-slate-900">Recepciones</h2>
			{#each order.receipts as receipt (receipt.id)}
				<div class="rounded-lg border border-slate-200 bg-white p-4 text-sm">
					<p class="font-medium text-slate-800">
						{formatOrderNumber('REC', receipt.number)} · {formatDateTime(receipt.receivedAt)} ·
						{receipt.receivedBy.name}
						{#if receipt.supplierInvoiceNumber}· Factura {receipt.supplierInvoiceNumber}{/if}
					</p>
					<ul class="mt-2 list-disc pl-5 text-slate-600">
						{#each receipt.items as item (item.id)}
							<li>
								{item.product.name}: {item.quantity} u. · lote {item.lot.lotNumber} · vence
								{formatDate(item.lot.expirationDate)} · Q{item.unitCost} · {LOT_STATUS_LABELS[
									item.initialStatus
								]}
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</section>
	{/if}
</div>
