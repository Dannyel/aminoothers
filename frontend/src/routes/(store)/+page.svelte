<script lang="ts">
	import { resolve } from '$app/paths';
	import ProductCard from '#lib/components/store/ProductCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const catalogPath = resolve('productos');
	const categories = $derived(data.categories.filter((c) => c.productCount > 0));
</script>

<!-- Los enlaces a categorías se arman sobre catalogPath, resuelto con resolve(). -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

<svelte:head>
	<title>{data.info.tradeName}</title>
</svelte:head>

<section class="bg-teal-800 text-white">
	<div class="mx-auto max-w-6xl px-4 py-12">
		<h1 class="text-3xl font-semibold">{data.info.tradeName}</h1>
		<p class="mt-2 max-w-xl text-teal-50">
			Productos de farmacia de venta libre con entrega a domicilio. Pague por transferencia o en
			efectivo al recibir.
		</p>
		<a
			href={catalogPath}
			class="mt-6 inline-block rounded-md bg-white px-5 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50"
			>Ver catálogo</a
		>
	</div>
</section>

<div class="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10">
	{#if categories.length > 0}
		<section aria-labelledby="home-categories">
			<h2 id="home-categories" class="mb-4 text-lg font-semibold text-slate-900">Categorías</h2>
			<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
				{#each categories as category (category.id)}
					<li>
						<a
							href="{catalogPath}?categoria={category.slug}"
							class="flex h-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 hover:border-teal-600"
						>
							{#if category.imageFileId}
								<img src="/media/{category.imageFileId}" alt="" class="size-12 object-contain" />
							{/if}
							<span>
								<span class="block font-medium text-slate-900">{category.name}</span>
								<span class="text-xs text-slate-500">{category.productCount} producto(s)</span>
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section aria-labelledby="home-latest">
		<div class="mb-4 flex items-center justify-between">
			<h2 id="home-latest" class="text-lg font-semibold text-slate-900">Nuevos en la tienda</h2>
			<a href={catalogPath} class="text-sm text-teal-800 hover:underline">Ver todo</a>
		</div>
		{#if data.latest.items.length === 0}
			<p class="text-slate-600">El catálogo estará disponible próximamente.</p>
		{:else}
			<ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
				{#each data.latest.items as product (product.id)}
					<li><ProductCard {product} /></li>
				{/each}
			</ul>
		{/if}
	</section>
</div>
