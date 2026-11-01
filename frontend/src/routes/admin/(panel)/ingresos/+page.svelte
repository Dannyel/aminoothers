<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import { formatDate, formatMoney } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const r = $derived(data.report);
	const field =
		'rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600';
	const card = 'rounded-lg border border-slate-200 bg-white p-5';
</script>

<!-- El enlace a comprobantes pendientes agrega filtros a una ruta resuelta con resolve(). -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

<PageHeading
	title="Ingresos"
	description="Pagos aprobados o cobrados menos reembolsos completados, por fecha. No es contabilidad de partida doble."
/>

<form method="get" class="mb-6 flex flex-wrap items-end gap-3">
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Desde</span>
		<input type="date" name="from" value={data.from} class={field} />
	</label>
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Hasta</span>
		<input type="date" name="to" value={data.to} class={field} />
	</label>
	<button
		class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
		>Consultar</button
	>
</form>

<p class="mb-4 text-sm text-slate-600">Del {formatDate(r.from)} al {formatDate(r.to)}</p>

<div class="grid gap-4 sm:grid-cols-3">
	<div class={card}>
		<p class="text-sm text-slate-500">Recibido ({r.receivedCount} pago(s))</p>
		<p class="text-2xl font-semibold">{formatMoney(r.received)}</p>
		<p class="text-xs text-slate-500">
			Transferencias {formatMoney(r.receivedByMethod.bankTransfer)} · Contra entrega {formatMoney(
				r.receivedByMethod.cashOnDelivery
			)}
		</p>
	</div>
	<div class={card}>
		<p class="text-sm text-slate-500">Reembolsado ({r.refundedCount})</p>
		<p class="text-2xl font-semibold text-red-700">−{formatMoney(r.refunded)}</p>
	</div>
	<div class={card}>
		<p class="text-sm text-slate-500">Ingreso neto</p>
		<p class="text-2xl font-semibold text-emerald-700">{formatMoney(r.net)}</p>
	</div>
	<div class={card}>
		<p class="text-sm text-slate-500">Comprobantes emitidos ({r.invoicesIssued})</p>
		<p class="text-2xl font-semibold">{formatMoney(r.invoicedTotal)}</p>
		<p class="text-xs text-slate-500">IVA incluido {formatMoney(r.invoicedTax)}</p>
	</div>
	<div class={card}>
		<p class="text-sm text-slate-500">Anulados ({r.invoicesVoided})</p>
		<p class="text-2xl font-semibold">{formatMoney(r.voidedTotal)}</p>
	</div>
	<div class={card}>
		<p class="text-sm text-slate-500">FEL pendientes de registrar</p>
		<p class="text-2xl font-semibold {r.felPending > 0 ? 'text-amber-700' : ''}">{r.felPending}</p>
		<a
			href="{resolve('admin/facturacion')}?felStatus=PENDING&status=ISSUED"
			class="text-xs text-teal-800 hover:underline">Ver comprobantes</a
		>
	</div>
</div>
