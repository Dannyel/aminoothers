<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import type { OrderStatus } from '#lib/api/types.ts';
	import {
		formatDateTime,
		formatMoney,
		formatOrderNumber,
		ORDER_STATUS_LABELS,
		ORDER_STATUS_TONES,
		PAYMENT_METHOD_LABELS
	} from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const field =
		'rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600';
</script>

<PageHeading title="Pedidos" description="Pedidos de la tienda y su avance." />

<form method="get" class="mb-4 grid gap-3 sm:grid-cols-6 sm:items-end" role="search">
	<label class="flex flex-col gap-1 text-sm sm:col-span-2">
		<span class="font-medium text-slate-700">Buscar (número, cliente o correo)</span>
		<input type="search" name="search" value={data.filters.search} maxlength={100} class={field} />
	</label>
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Estado</span>
		<select name="status" value={data.filters.status} class={field}>
			<option value="">Todos</option>
			{#each data.statuses as status (status)}
				<option value={status}>{ORDER_STATUS_LABELS[status as OrderStatus]}</option>
			{/each}
		</select>
	</label>
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Pago</span>
		<select name="paymentMethod" value={data.filters.paymentMethod} class={field}>
			<option value="">Todos</option>
			<option value="BANK_TRANSFER">Transferencia</option>
			<option value="CASH_ON_DELIVERY">Contra entrega</option>
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

{#if data.orders.items.length === 0}
	<EmptyState title="No hay pedidos que coincidan" />
{:else}
	<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead
				class="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
			>
				<tr>
					<th class="px-4 py-3">Pedido</th>
					<th class="px-4 py-3">Fecha</th>
					<th class="px-4 py-3">Cliente</th>
					<th class="px-4 py-3">Pago</th>
					<th class="px-4 py-3">Estado</th>
					<th class="px-4 py-3 text-right">Total</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.orders.items as order (order.id)}
					<tr>
						<td class="px-4 py-3">
							<a
								href={resolve(`admin/pedidos/${order.id}`)}
								class="font-medium text-teal-800 hover:underline"
								>{formatOrderNumber('PED', order.number)}</a
							>
							<p class="text-xs text-slate-500">{order.itemCount} unidad(es)</p>
						</td>
						<td class="px-4 py-3 whitespace-nowrap">{formatDateTime(order.placedAt)}</td>
						<td class="px-4 py-3">
							{order.customerName}
							<p class="text-xs text-slate-500">{order.customerEmail}</p>
						</td>
						<td class="px-4 py-3">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</td>
						<td class="px-4 py-3">
							<Badge tone={ORDER_STATUS_TONES[order.status]}
								>{ORDER_STATUS_LABELS[order.status]}</Badge
							>
						</td>
						<td class="px-4 py-3 text-right font-semibold">{formatMoney(order.total)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="mt-4">
		<Pagination
			basePath={resolve('admin/pedidos')}
			page={data.orders.page}
			pageSize={data.orders.pageSize}
			total={data.orders.total}
		/>
	</div>
{/if}
