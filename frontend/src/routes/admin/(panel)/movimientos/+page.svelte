<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import { formatDateTime, MOVEMENT_TYPE_LABELS, REASON_LABELS } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const field =
		'rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600';
</script>

<PageHeading
	title="Movimientos de inventario"
	description="Historial inmutable: los errores se corrigen con un ajuste."
/>

<form method="get" class="mb-4 grid gap-3 sm:grid-cols-5 sm:items-end" role="search">
	<input type="hidden" name="productId" value={data.filters.productId} />
	<label class="flex flex-col gap-1 text-sm sm:col-span-2">
		<span class="font-medium text-slate-700">Buscar (lote, producto o SKU)</span>
		<input type="search" name="search" value={data.filters.search} maxlength={100} class={field} />
	</label>
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Tipo</span>
		<select name="type" value={data.filters.type} class={field}>
			<option value="">Todos</option>
			{#each Object.entries(MOVEMENT_TYPE_LABELS) as [value, label] (value)}<option {value}
					>{label}</option
				>{/each}
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
		>
			Filtrar
		</button>
	</div>
</form>

{#if data.movements.items.length === 0}
	<EmptyState title="No hay movimientos que coincidan" />
{:else}
	<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead
				class="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
			>
				<tr>
					<th class="px-4 py-3">N.º</th>
					<th class="px-4 py-3">Fecha</th>
					<th class="px-4 py-3">Producto / lote</th>
					<th class="px-4 py-3">Tipo</th>
					<th class="px-4 py-3 text-right">Cantidad</th>
					<th class="px-4 py-3 text-right">Saldo</th>
					<th class="px-4 py-3">Responsable</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.movements.items as m (m.id)}
					<tr>
						<td class="px-4 py-3 text-slate-500">{m.number}</td>
						<td class="px-4 py-3 whitespace-nowrap">{formatDateTime(m.createdAt)}</td>
						<td class="px-4 py-3">
							<a
								href={resolve(`admin/inventario/${m.product.id}`)}
								class="text-teal-800 hover:underline">{m.product.name}</a
							>
							<p class="text-slate-500">{m.product.sku} · Lote {m.lot.lotNumber}</p>
						</td>
						<td class="px-4 py-3">
							{MOVEMENT_TYPE_LABELS[m.type]}
							{#if m.reasonCode}<p class="text-slate-500">
									{REASON_LABELS[m.reasonCode] ?? m.reasonCode}
								</p>{/if}
							{#if m.notes}<p class="text-xs text-slate-500">{m.notes}</p>{/if}
						</td>
						<td
							class="px-4 py-3 text-right font-semibold {m.quantity > 0
								? 'text-emerald-700'
								: 'text-red-700'}">{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td
						>
						<td class="px-4 py-3 text-right">{m.balanceAfter}</td>
						<td class="px-4 py-3 text-slate-600">{m.user.name}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="mt-4">
		<Pagination
			basePath={resolve('admin/movimientos')}
			page={data.movements.page}
			pageSize={data.movements.pageSize}
			total={data.movements.total}
		/>
	</div>
{/if}
