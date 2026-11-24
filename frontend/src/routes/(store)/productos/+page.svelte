<script lang="ts">
	import { resolve } from '$app/paths';
	import { navigating } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import ProductCard from '#lib/components/store/ProductCard.svelte';
	import ProductCardSkeleton from '#lib/components/store/ProductCardSkeleton.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const catalogPath = resolve('productos');
	const filters = $derived(data.filters);
	const category = $derived(data.categories.find((c) => c.slug === filters.categoria));
	const subcategory = $derived(
		category?.subcategories.find((s) => s.slug === filters.subcategoria)
	);
	const brand = $derived(data.products.brands.find((b) => b.slug === filters.marca));
	const title = $derived(
		filters.q ? `«${filters.q}»` : (subcategory?.name ?? category?.name ?? 'Todos los productos')
	);
	const total = $derived(data.products.total);
	// Muestra siluetas solo mientras se navega dentro del catálogo.
	const loading = $derived(navigating.to?.url.pathname === catalogPath);

	const SORT_OPTIONS = [
		{ value: 'name', label: 'Nombre (A–Z)' },
		{ value: 'newest', label: 'Más recientes' },
		{ value: 'price_asc', label: 'Precio: menor a mayor' },
		{ value: 'price_desc', label: 'Precio: mayor a menor' }
	] as const;

	type Key = 'q' | 'categoria' | 'subcategoria' | 'marca' | 'orden';
	/** Enlace al catálogo con los filtros actuales cambiados; siempre vuelve a la página 1. */
	function href(changes: Partial<Record<Key, string>>) {
		const params = new SvelteURLSearchParams();
		const next = { ...filters, ...changes };
		if (next.q) params.set('q', next.q);
		if (next.categoria) params.set('categoria', next.categoria);
		if (next.categoria && next.subcategoria) params.set('subcategoria', next.subcategoria);
		if (next.marca) params.set('marca', next.marca);
		if (next.orden && next.orden !== 'name') params.set('orden', next.orden);
		const query = params.toString();
		return query ? `${catalogPath}?${query}` : catalogPath;
	}

	const chips = $derived(
		[
			filters.q && { label: `Búsqueda: ${filters.q}`, href: href({ q: '' }) },
			category && { label: category.name, href: href({ categoria: '', subcategoria: '' }) },
			subcategory && { label: subcategory.name, href: href({ subcategoria: '' }) },
			brand && { label: brand.name, href: href({ marca: '' }) }
		].filter((c): c is { label: string; href: string } => Boolean(c))
	);

	const option = (active: boolean) =>
		`flex min-h-9 w-full items-center justify-between rounded-lg px-3 text-left text-sm transition-colors duration-200 ${
			active
				? 'bg-stone-900 font-medium text-white'
				: 'text-stone-700 hover:bg-stone-100 hover:text-stone-950'
		}`;
</script>

<!-- Los enlaces se arman sobre catalogPath, resuelto con resolve(). -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

<svelte:head>
	<title>{filters.q ? `Resultados para ${title}` : title} · {data.info.tradeName}</title>
</svelte:head>

{#snippet filterPanel()}
	<div class="flex flex-col gap-8">
		<section aria-labelledby="filter-category">
			<h2 id="filter-category" class="eyebrow mb-3">Categoría</h2>
			<ul class="flex flex-col gap-0.5">
				<li>
					<a
						href={href({ categoria: '', subcategoria: '' })}
						class={option(!filters.categoria)}
						aria-current={!filters.categoria ? 'true' : undefined}>Todas</a
					>
				</li>
				{#each data.categories as c (c.id)}
					{@const active = c.slug === filters.categoria}
					<li>
						<a
							href={href({ categoria: c.slug, subcategoria: '' })}
							class={option(active && !filters.subcategoria)}
							aria-current={active ? 'true' : undefined}
						>
							{c.name}
							<span class="text-xs tabular-nums opacity-60">{c.productCount}</span>
						</a>
						{#if active && c.subcategories.length > 0}
							<ul class="my-1 ml-3 flex flex-col gap-0.5 border-l border-stone-200 pl-2">
								{#each c.subcategories as s (s.id)}
									<li>
										<a
											href={href({ subcategoria: s.slug })}
											class={option(s.slug === filters.subcategoria)}
											aria-current={s.slug === filters.subcategoria ? 'true' : undefined}
											>{s.name}</a
										>
									</li>
								{/each}
							</ul>
						{/if}
					</li>
				{/each}
			</ul>
		</section>

		{#if data.products.brands.length > 0}
			<section aria-labelledby="filter-brand">
				<h2 id="filter-brand" class="eyebrow mb-3">Marca</h2>
				<ul class="flex flex-col gap-0.5">
					<li>
						<a href={href({ marca: '' })} class={option(!filters.marca)}>Todas</a>
					</li>
					{#each data.products.brands as b (b.id)}
						<li>
							<a
								href={href({ marca: b.slug })}
								class={option(b.slug === filters.marca)}
								aria-current={b.slug === filters.marca ? 'true' : undefined}>{b.name}</a
							>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>
{/snippet}

<div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
	<nav aria-label="Ruta" class="mb-6 text-sm text-stone-500">
		<ol class="flex flex-wrap items-center gap-1.5">
			<li><a href={resolve('')} class="hover:text-stone-950">Inicio</a></li>
			<li aria-hidden="true">/</li>
			<li>
				{#if category || filters.q}
					<a href={catalogPath} class="hover:text-stone-950">Productos</a>
				{:else}
					<span aria-current="page" class="text-stone-950">Productos</span>
				{/if}
			</li>
			{#if category}
				<li aria-hidden="true">/</li>
				<li>
					{#if subcategory}
						<a href={href({ subcategoria: '' })} class="hover:text-stone-950">{category.name}</a>
					{:else}
						<span aria-current="page" class="text-stone-950">{category.name}</span>
					{/if}
				</li>
			{/if}
			{#if subcategory}
				<li aria-hidden="true">/</li>
				<li><span aria-current="page" class="text-stone-950">{subcategory.name}</span></li>
			{/if}
		</ol>
	</nav>

	<header class="mb-10 flex flex-wrap items-end justify-between gap-6">
		<div>
			{#if filters.q}<p class="eyebrow mb-2">Resultados para</p>{/if}
			<h1 class="text-4xl sm:text-5xl">{title}</h1>
			{#if category?.description && !filters.q}
				<p class="mt-3 max-w-2xl text-stone-600">{category.description}</p>
			{/if}
		</div>
	</header>

	<div class="grid gap-10 lg:grid-cols-[15rem_1fr] lg:gap-12">
		<aside class="hidden lg:block" aria-label="Filtros">
			<div class="sticky top-36">{@render filterPanel()}</div>
		</aside>

		<div class="min-w-0">
			<div
				class="mb-6 flex flex-wrap items-center gap-3 border-b border-stone-200 pb-4 sm:flex-nowrap"
			>
				<!-- Filtros en móvil: panel desplegable con los mismos enlaces. -->
				<details class="group w-full sm:w-auto lg:hidden">
					<summary
						class="btn btn-secondary min-h-10 w-full justify-between px-4 sm:w-auto sm:justify-center"
					>
						<span class="flex items-center gap-2">
							<Icon name="sliders" class="size-4" /> Filtros
							{#if chips.length > 0}
								<span
									class="flex size-5 items-center justify-center rounded-full bg-stone-900 text-[0.6875rem] text-white"
									>{chips.length}</span
								>
							{/if}
						</span>
						<Icon
							name="chevronDown"
							class="size-4 transition-transform duration-200 group-open:rotate-180"
						/>
					</summary>
					<div class="mt-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-raised">
						{@render filterPanel()}
					</div>
				</details>

				<p class="text-sm text-stone-500 sm:mr-auto" aria-live="polite">
					<span class="font-medium text-stone-950 tabular-nums">{total}</span>
					{total === 1 ? 'producto' : 'productos'}
				</p>

				<form method="get" action={catalogPath} class="flex items-center gap-2">
					{#if filters.q}<input type="hidden" name="q" value={filters.q} />{/if}
					{#if filters.categoria}
						<input type="hidden" name="categoria" value={filters.categoria} />
					{/if}
					{#if filters.subcategoria}
						<input type="hidden" name="subcategoria" value={filters.subcategoria} />
					{/if}
					{#if filters.marca}<input type="hidden" name="marca" value={filters.marca} />{/if}
					<label for="catalog-sort" class="text-sm whitespace-nowrap text-stone-500"
						>Ordenar por</label
					>
					<select
						id="catalog-sort"
						name="orden"
						value={filters.orden}
						onchange={(e) => e.currentTarget.form?.requestSubmit()}
						class="min-h-10 rounded-full! border-stone-200! py-1.5 pr-9 pl-4 text-sm"
					>
						{#each SORT_OPTIONS as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
					</select>
					<noscript><button class="btn btn-secondary min-h-10 px-4">Aplicar</button></noscript>
				</form>
			</div>

			{#if chips.length > 0}
				<ul class="mb-8 flex flex-wrap items-center gap-2" aria-label="Filtros activos">
					{#each chips as chip (chip.label)}
						<li>
							<a
								href={chip.href}
								class="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-stone-100 pr-2.5 pl-3.5 text-sm text-stone-800 transition-colors duration-200 hover:bg-stone-200"
							>
								{chip.label}
								<Icon name="close" class="size-3.5" />
								<span class="sr-only">(quitar filtro)</span>
							</a>
						</li>
					{/each}
					<li>
						<a href={catalogPath} class="link ml-1 text-sm">Limpiar todo</a>
					</li>
				</ul>
			{/if}

			<div aria-busy={loading}>
				{#if loading}
					<p class="sr-only" role="status">Cargando productos…</p>
					<ul class="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 xl:grid-cols-3">
						{#each { length: 6 }, i (i)}<li><ProductCardSkeleton /></li>{/each}
					</ul>
				{:else if data.products.items.length === 0}
					<EmptyState title="No encontramos productos" icon="search">
						Pruebe con otro nombre, marca o ingrediente, o
						<a href={catalogPath} class="link">vea todo el catálogo</a>.
					</EmptyState>
				{:else}
					<ul class="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 xl:grid-cols-3">
						{#each data.products.items as product, i (product.id)}
							<li><ProductCard {product} eager={i < 3} /></li>
						{/each}
					</ul>
					<div class="mt-14 border-t border-stone-200 pt-6">
						<Pagination
							basePath={catalogPath}
							page={data.products.page}
							pageSize={data.products.pageSize}
							{total}
						/>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
