<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import {
		can,
		formatDate,
		formatMoney,
		formatOrderNumber,
		PURCHASE_ORDER_STATUS_LABELS,
		PURCHASE_ORDER_STATUS_TONES
	} from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const field =
		'rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600';
</script>

<PageHeading title="Órdenes de compra">
	{#snippet actions()}
		{#if can(data.staff, 'purchases.manage')}
			<a
				href={resolve('admin/compras/nueva')}
				class="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
				>Nueva orden</a
			>
		{/if}
	{/snippet}
</PageHeading>

<form method="get" class="mb-4 flex flex-wrap items-end gap-3" role="search">
	<input type="hidden" name="supplierId" value={data.filters.supplierId} />
	<label class="flex min-w-60 flex-1 flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Buscar (número o proveedor)</span>
		<input type="search" name="search" value={data.filters.search} maxlength={100} class={field} />
	</label>
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Estado</span>
		<select name="status" value={data.filters.status} class={field}>
			<option value="">Todos</option>
			{#each Object.entries(PURCHASE_ORDER_STATUS_LABELS) as [value, label] (value)}<option {value}
					>{label}</option
				>{/each}
		</select>
	</label>
	<button
		class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
	>
		Filtrar
	</button>
</form>

{#if data.orders.items.length === 0}
	<EmptyState title="No hay órdenes de compra" />
{:else}
	<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead
				class="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
			>
				<tr>
					<th class="px-4 py-3">Orden</th>
					<th class="px-4 py-3">Proveedor</th>
					<th class="px-4 py-3">Fecha</th>
					<th class="px-4 py-3">Estado</th>
					<th class="px-4 py-3 text-right">Total</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.orders.items as order (order.id)}
					<tr class="hover:bg-slate-50">
						<td class="px-4 py-3">
							<a
								href={resolve(`admin/compras/${order.id}`)}
								class="font-medium text-teal-800 hover:underline"
							>
								{formatOrderNumber('OC', order.number)}
							</a>
						</td>
						<td class="px-4 py-3">{order.supplier.name}</td>
						<td class="px-4 py-3 whitespace-nowrap">{formatDate(order.orderDate)}</td>
						<td class="px-4 py-3">
							<Badge tone={PURCHASE_ORDER_STATUS_TONES[order.status]}>
								{PURCHASE_ORDER_STATUS_LABELS[order.status]}
							</Badge>
						</td>
						<td class="px-4 py-3 text-right whitespace-nowrap">{formatMoney(order.total)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="mt-4">
		<Pagination
			basePath={resolve('admin/compras')}
			page={data.orders.page}
			pageSize={data.orders.pageSize}
			total={data.orders.total}
		/>
	</div>
{/if}
