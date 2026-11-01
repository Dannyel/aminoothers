<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';
	import { can, formatDate } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const tabs = $derived([
		{ value: 'all', label: 'Todos', count: null },
		{ value: 'low', label: 'Existencias bajas', count: data.alerts.lowStockProducts },
		{ value: 'expired', label: 'Con vencidos', count: data.alerts.expiredLots },
		{ value: 'near', label: 'Próximos a vencer', count: data.alerts.nearExpiryLots },
		{ value: 'quarantine', label: 'En cuarentena', count: data.alerts.quarantineLots }
	]);
	const tabHref = (value: string) =>
		value === 'all' ? resolve('admin/inventario') : resolve(`admin/inventario?alerta=${value}`);
</script>

<PageHeading
	title="Existencias"
	description="Disponible = en lotes habilitados, sin reservar y con al menos {data.settings
		.minShelfLifeDaysForSale} días de vida útil."
/>

<div class="flex flex-col gap-4">
	<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
	<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />
	{#if data.alerts.recalledLots > 0}
		<Alert
			variant="warning"
			messages="Hay {data.alerts
				.recalledLots} lote(s) retirado(s) del mercado con existencia: deles de baja o devuélvalos al proveedor."
		/>
	{/if}

	<nav class="flex flex-wrap gap-2" aria-label="Alertas">
		{#each tabs as tab (tab.value)}
			<a
				href={tabHref(tab.value)}
				aria-current={data.alert === tab.value ? 'page' : undefined}
				class="rounded-full border px-3 py-1 text-sm {data.alert === tab.value
					? 'border-teal-700 bg-teal-700 text-white'
					: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}"
			>
				{tab.label}
				{#if tab.count}<span class="ml-1 font-semibold">{tab.count}</span>{/if}
			</a>
		{/each}
	</nav>

	<form method="get" class="flex flex-wrap items-end gap-3" role="search">
		<input type="hidden" name="alerta" value={data.alert === 'all' ? '' : data.alert} />
		<label class="flex min-w-60 flex-1 flex-col gap-1 text-sm">
			<span class="font-medium text-slate-700">Buscar producto</span>
			<input
				type="search"
				name="search"
				value={data.search}
				maxlength={100}
				class="rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600"
			/>
		</label>
		<button
			class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
			>Buscar</button
		>
	</form>

	{#if data.stock.items.length === 0}
		<EmptyState title="No hay productos que coincidan" />
	{:else}
		<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
			<table class="min-w-full divide-y divide-slate-200 text-sm">
				<thead
					class="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
				>
					<tr>
						<th class="px-4 py-3">Producto</th>
						<th class="px-4 py-3 text-right">Física</th>
						<th class="px-4 py-3 text-right">Reservada</th>
						<th class="px-4 py-3 text-right">Disponible</th>
						<th class="px-4 py-3 text-right">Vencida</th>
						<th class="px-4 py-3 text-right">Cuarentena</th>
						<th class="px-4 py-3">Próx. vencimiento</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each data.stock.items as row (row.productId)}
						<tr class="hover:bg-slate-50">
							<td class="px-4 py-3">
								<a
									href={resolve(`admin/inventario/${row.productId}`)}
									class="font-medium text-teal-800 hover:underline">{row.name}</a
								>
								<p class="text-slate-500">
									{row.sku}
									{#if !row.isActive}<Badge>Inactivo</Badge>{/if}
									{#if row.isLowStock}<Badge tone="warning"
											>Bajo (mín. {row.lowStockThreshold})</Badge
										>{/if}
								</p>
							</td>
							<td class="px-4 py-3 text-right">{row.physical}</td>
							<td class="px-4 py-3 text-right">{row.reserved}</td>
							<td class="px-4 py-3 text-right font-semibold">{row.available}</td>
							<td class="px-4 py-3 text-right {row.expired ? 'text-red-700' : ''}">{row.expired}</td
							>
							<td class="px-4 py-3 text-right {row.quarantine ? 'text-amber-700' : ''}"
								>{row.quarantine}</td
							>
							<td class="px-4 py-3 whitespace-nowrap">{formatDate(row.nextExpiration)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<Pagination
			basePath={resolve('admin/inventario')}
			page={data.stock.page}
			pageSize={data.stock.pageSize}
			total={data.stock.total}
		/>
	{/if}

	{#if can(data.staff, 'inventory.settings')}
		<details class="rounded-lg border border-slate-200 bg-white p-4">
			<summary class="cursor-pointer text-sm font-medium text-slate-800"
				>Parámetros de vencimiento</summary
			>
			<form
				method="post"
				action="?/settings"
				class="mt-4 grid max-w-xl gap-4 sm:grid-cols-2"
				use:enhance={() =>
					async ({ update }) =>
						update({ reset: false })}
			>
				<TextField
					label="Vida útil mínima para vender (días)"
					name="minShelfLifeDaysForSale"
					type="number"
					min={0}
					max={365}
					required
					value={String(data.settings.minShelfLifeDaysForSale)}
					hint="Los lotes que vencen antes no se venden."
				/>
				<TextField
					label="Alerta de próximo a vencer (días)"
					name="nearExpiryDays"
					type="number"
					min={1}
					max={730}
					required
					value={String(data.settings.nearExpiryDays)}
				/>
				<div><Button type="submit">Guardar</Button></div>
			</form>
		</details>
	{/if}
</div>
