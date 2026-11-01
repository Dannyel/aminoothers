<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import {
		FEL_STATUS_LABELS,
		FEL_STATUS_TONES,
		formatDateTime,
		formatMoney,
		formatOrderNumber,
		INVOICE_STATUS_LABELS
	} from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const field =
		'rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600';
</script>

<PageHeading
	title="Comprobantes y FEL"
	description="Comprobantes internos de los pedidos pagados. La FEL se emite en el portal del certificador y aquí se registran sus datos."
/>

<form method="get" class="mb-4 grid gap-3 sm:grid-cols-6 sm:items-end" role="search">
	<label class="flex flex-col gap-1 text-sm sm:col-span-2">
		<span class="font-medium text-slate-700">Buscar (número, pedido, cliente o NIT)</span>
		<input type="search" name="search" value={data.filters.search} maxlength={100} class={field} />
	</label>
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Estado</span>
		<select name="status" value={data.filters.status} class={field}>
			<option value="">Todos</option>
			<option value="ISSUED">Emitidos</option>
			<option value="VOIDED">Anulados</option>
		</select>
	</label>
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">FEL</span>
		<select name="felStatus" value={data.filters.felStatus} class={field}>
			<option value="">Todas</option>
			<option value="PENDING">Pendiente</option>
			<option value="CERTIFIED">Registrada</option>
			<option value="NOT_APPLICABLE">No aplica</option>
		</select>
	</label>
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Desde</span>
		<input type="date" name="from" value={data.filters.from} class={field} />
	</label>
	<div class="flex items-end gap-2">
		<label class="flex flex-1 flex-col gap-1 text-sm">
			<span class="font-medium text-slate-700">Hasta</span>
			<input type="date" name="to" value={data.filters.to} class={field} />
		</label>
		<button
			class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
			>Filtrar</button
		>
	</div>
</form>

{#if data.invoices.items.length === 0}
	<EmptyState title="No hay comprobantes que coincidan" />
{:else}
	<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead
				class="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
			>
				<tr>
					<th class="px-4 py-3">Comprobante</th>
					<th class="px-4 py-3">Pedido</th>
					<th class="px-4 py-3">Cliente</th>
					<th class="px-4 py-3">FEL</th>
					<th class="px-4 py-3 text-right">Total</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.invoices.items as inv (inv.id)}
					<tr>
						<td class="px-4 py-3">
							<a
								href={resolve(`admin/facturacion/${inv.id}`)}
								class="font-medium text-teal-800 hover:underline"
								>{formatOrderNumber('CI', inv.number)}</a
							>
							<p class="text-xs text-slate-500">{formatDateTime(inv.issuedAt)}</p>
							{#if inv.status === 'VOIDED'}<Badge tone="danger"
									>{INVOICE_STATUS_LABELS.VOIDED}</Badge
								>{/if}
						</td>
						<td class="px-4 py-3">{formatOrderNumber('PED', inv.orderNumber)}</td>
						<td class="px-4 py-3"
							>{inv.customerName}
							<p class="text-xs text-slate-500">NIT {inv.customerTaxId}</p></td
						>
						<td class="px-4 py-3">
							<Badge tone={FEL_STATUS_TONES[inv.fel.status]}
								>{FEL_STATUS_LABELS[inv.fel.status]}</Badge
							>
							{#if inv.fel.series}<p class="text-xs text-slate-500">
									{inv.fel.series}-{inv.fel.number}
								</p>{/if}
						</td>
						<td class="px-4 py-3 text-right font-semibold">{formatMoney(inv.total)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="mt-4">
		<Pagination
			basePath={resolve('admin/facturacion')}
			page={data.invoices.page}
			pageSize={data.invoices.pageSize}
			total={data.invoices.total}
		/>
	</div>
{/if}
