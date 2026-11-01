<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import { can, formatMoney, SALE_CONDITION_LABELS } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const selectClass =
		'rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600';
</script>

<PageHeading
	title="Productos"
	description="Búsqueda por nombre, SKU, código de barras, marca o principio activo."
>
	{#snippet actions()}
		{#if can(data.staff, 'products.manage')}
			<a
				href={resolve('admin/productos/nuevo')}
				class="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
				>Nuevo producto</a
			>
		{/if}
	{/snippet}
</PageHeading>

<form method="get" class="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-7 lg:items-end" role="search">
	<label class="flex flex-col gap-1 text-sm sm:col-span-3 lg:col-span-2">
		<span class="font-medium text-slate-700">Buscar</span>
		<input
			type="search"
			name="search"
			value={data.filters.search}
			maxlength={100}
			class={selectClass}
		/>
	</label>
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Categoría</span>
		<select name="categoryId" value={data.filters.categoryId} class={selectClass}>
			<option value="">Todas</option>
			{#each data.categories as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
		</select>
	</label>
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Marca</span>
		<select name="brandId" value={data.filters.brandId} class={selectClass}>
			<option value="">Todas</option>
			{#each data.brands as b (b.id)}<option value={b.id}>{b.name}</option>{/each}
		</select>
	</label>
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Condición</span>
		<select name="saleCondition" value={data.filters.saleCondition} class={selectClass}>
			<option value="">Todas</option>
			{#each Object.entries(SALE_CONDITION_LABELS) as [value, label] (value)}
				<option {value}>{label}</option>
			{/each}
		</select>
	</label>
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Estado</span>
		<select name="status" value={data.filters.status} class={selectClass}>
			<option value="all">Todos</option>
			<option value="active">Activos</option>
			<option value="inactive">Inactivos</option>
		</select>
	</label>
	<div class="flex items-end gap-2">
		<label class="flex flex-1 flex-col gap-1 text-sm">
			<span class="font-medium text-slate-700">En línea</span>
			<select name="onlineSale" value={data.filters.onlineSale} class={selectClass}>
				<option value="all">Todos</option>
				<option value="yes">Habilitados</option>
				<option value="no">No habilitados</option>
			</select>
		</label>
		<button
			class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
		>
			Filtrar
		</button>
	</div>
</form>

{#if data.result.items.length === 0}
	<EmptyState title="No hay productos que coincidan" />
{:else}
	<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead
				class="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
			>
				<tr>
					<th class="px-4 py-3">Producto</th>
					<th class="px-4 py-3">Categoría</th>
					<th class="px-4 py-3 text-right">Precio</th>
					<th class="px-4 py-3">Estado</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.result.items as product (product.id)}
					<tr class="hover:bg-slate-50">
						<td class="px-4 py-3">
							<div class="flex items-center gap-3">
								{#if product.primaryImageFileId}
									<img
										src={resolve(`media/${product.primaryImageFileId}`)}
										alt=""
										class="size-10 rounded border border-slate-200 object-cover"
										loading="lazy"
									/>
								{:else}
									<div class="size-10 rounded border border-dashed border-slate-300"></div>
								{/if}
								<div>
									<a
										href={resolve(`admin/productos/${product.id}`)}
										class="font-medium text-teal-800 hover:underline">{product.name}</a
									>
									<p class="text-slate-500">
										{product.sku}
										{#if product.presentation}· {product.presentation.name}{/if}
										{#if product.concentration}· {product.concentration.name}{/if}
									</p>
								</div>
							</div>
						</td>
						<td class="px-4 py-3 text-slate-700">{product.category.name}</td>
						<td class="px-4 py-3 text-right whitespace-nowrap text-slate-900"
							>{formatMoney(product.price)}</td
						>
						<td class="px-4 py-3">
							<div class="flex flex-wrap gap-1">
								{#if !product.isActive}<Badge>Inactivo</Badge>{/if}
								{#if product.saleCondition !== 'OTC'}
									<Badge tone="warning">{SALE_CONDITION_LABELS[product.saleCondition]}</Badge>
								{/if}
								{#if product.onlineSaleEnabled}<Badge tone="success">En línea</Badge>{/if}
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="mt-4">
		<Pagination
			basePath={resolve('admin/productos')}
			page={data.result.page}
			pageSize={data.result.pageSize}
			total={data.result.total}
		/>
	</div>
{/if}
