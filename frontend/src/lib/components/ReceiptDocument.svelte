<script lang="ts">
	import type { Invoice } from '#lib/api/types.ts';
	import {
		formatDateTime,
		formatMoney,
		formatOrderNumber,
		INVOICE_STATUS_LABELS
	} from '#lib/utils/labels.ts';

	let { invoice, issuer }: { invoice: Invoice; issuer: string } = $props();
</script>

<!-- Comprobante interno: deliberadamente distinto de una factura FEL (D11). -->
<article
	class="flex flex-col gap-4 rounded-lg border border-slate-300 bg-white p-6 text-sm print:border-0 print:p-0"
>
	<p
		class="rounded-md border-2 border-dashed border-amber-400 bg-amber-50 px-4 py-3 text-center font-semibold text-amber-900"
	>
		{invoice.legend}
	</p>
	<header class="flex flex-wrap justify-between gap-3">
		<div>
			<h1 class="text-lg font-semibold text-slate-900">
				Comprobante interno {formatOrderNumber('CI', invoice.number)}
			</h1>
			<p class="text-slate-600">{issuer}</p>
		</div>
		<div class="text-right">
			<p>Pedido {formatOrderNumber('PED', invoice.orderNumber)}</p>
			<p>{formatDateTime(invoice.issuedAt)}</p>
			{#if invoice.status === 'VOIDED'}
				<p class="font-semibold text-red-700">
					{INVOICE_STATUS_LABELS.VOIDED}: {invoice.voidReason}
				</p>
			{/if}
		</div>
	</header>
	<section>
		<p>Cliente: {invoice.customerName} · NIT {invoice.customerTaxId}</p>
		{#if invoice.customerAddress}<p class="text-slate-600">{invoice.customerAddress}</p>{/if}
	</section>
	<table class="min-w-full text-sm">
		<thead class="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
			<tr>
				<th class="py-2">Descripción</th>
				<th class="py-2 text-right">Cant.</th>
				<th class="py-2 text-right">Precio</th>
				<th class="py-2 text-right">Descuento</th>
				<th class="py-2 text-right">Total</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-slate-100">
			{#each invoice.items as item, i (i)}
				<tr>
					<td class="py-2">{item.description}</td>
					<td class="py-2 text-right">{item.quantity}</td>
					<td class="py-2 text-right">{formatMoney(item.unitPrice)}</td>
					<td class="py-2 text-right"
						>{Number(item.discount) > 0 ? `−${formatMoney(item.discount)}` : '—'}</td
					>
					<td class="py-2 text-right">{formatMoney(item.lineTotal)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<dl class="ml-auto grid w-full max-w-xs grid-cols-2 gap-1">
		<dt class="text-slate-600">Subtotal</dt>
		<dd class="text-right">{formatMoney(invoice.subtotal)}</dd>
		{#if Number(invoice.discountTotal) > 0}
			<dt class="text-slate-600">Descuentos</dt>
			<dd class="text-right">−{formatMoney(invoice.discountTotal)}</dd>
		{/if}
		<dt class="font-semibold">Total</dt>
		<dd class="text-right font-semibold">{formatMoney(invoice.total)}</dd>
		<dt class="text-xs text-slate-500">IVA incluido</dt>
		<dd class="text-right text-xs text-slate-500">{formatMoney(invoice.taxTotal)}</dd>
	</dl>
	{#if invoice.fel.status === 'CERTIFIED'}
		<p class="text-slate-700">
			Factura electrónica emitida: serie {invoice.fel.series}, número {invoice.fel.number},
			autorización
			{invoice.fel.authorizationUuid} ({invoice.fel.certifier}, {formatDateTime(
				invoice.fel.certifiedAt
			)}). Consulte la factura en el portal de la SAT o con el certificador.
		</p>
	{/if}
</article>
