<script lang="ts">
	import { resolve } from '$app/paths';
	import { navigating } from '$app/state';
	import ProductCard from '#lib/components/store/ProductCard.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const filters = $derived(data.filters);
	const category = $derived(data.categories.find((c) => c.slug === filters.categoria));
	const subcategory = $derived(
		category?.subcategories.find((s) => s.slug === filters.subcategoria)
	);
	const title = $derived(
		filters.q
			? `Resultados para «${filters.q}»`
			: (subcategory?.name ?? category?.name ?? 'Catálogo')
	);
	const field =
		'rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600';
</script>

<svelte:head>
	<title>{title} · {data.info.tradeName}</title>
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-8">
	<div class="mb-6">
		<h1 class="text-2xl font-semibold text-slate-900">{title}</h1>
		<p class="text-sm text-slate-600">{data.products.total} producto(s)</p>
	</div>

	<form
		method="get"
		action={resolve('productos')}
		class="mb-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-4 sm:items-end"
	>
		<input type="hidden" name="q" value={filters.q} />
		<label class="flex flex-col gap-1 text-sm">
			<span class="font-medium text-slate-700">Categoría</span>
			<select name="categoria" value={filters.categoria} class={field}>
				<option value="">Todas</option>
				{#each data.categories as c (c.id)}<option value={c.slug}>{c.name}</option>{/each}
			</select>
		</label>
		{#if category && category.subcategories.length > 0}
			<label class="flex flex-col gap-1 text-sm">
				<span class="font-medium text-slate-700">Subcategoría</span>
				<select name="subcategoria" value={filters.subcategoria} class={field}>
					<option value="">Todas</option>
					{#each category.subcategories as s (s.id)}<option value={s.slug}>{s.name}</option>{/each}
				</select>
			</label>
		{/if}
		<label class="flex flex-col gap-1 text-sm">
			<span class="font-medium text-slate-700">Marca</span>
			<select name="marca" value={filters.marca} class={field}>
				<option value="">Todas</option>
				{#each data.products.brands as b (b.id)}<option value={b.slug}>{b.name}</option>{/each}
			</select>
		</label>
		<div class="flex items-end gap-2">
			<label class="flex flex-1 flex-col gap-1 text-sm">
				<span class="font-medium text-slate-700">Ordenar por</span>
				<select name="orden" value={filters.orden} class={field}>
					<option value="name">Nombre</option>
					<option value="price_asc">Menor precio</option>
					<option value="price_desc">Mayor precio</option>
					<option value="newest">Más recientes</option>
				</select>
			</label>
			<button
				class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
			>
				Aplicar
			</button>
		</div>
	</form>

	<div aria-busy={navigating.to !== null}>
		{#if navigating.to}
			<p class="mb-4 text-sm text-slate-500" role="status">Cargando productos…</p>
		{/if}
		{#if data.products.items.length === 0}
			<EmptyState title="No encontramos productos con esos criterios">
				Pruebe con otro nombre, marca o principio activo.
			</EmptyState>
		{:else}
			<ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
				{#each data.products.items as product (product.id)}
					<li><ProductCard {product} /></li>
				{/each}
			</ul>
			<div class="mt-6">
				<Pagination
					basePath={resolve('productos')}
					page={data.products.page}
					pageSize={data.products.pageSize}
					total={data.products.total}
				/>
			</div>
		{/if}
	</div>
</div>
