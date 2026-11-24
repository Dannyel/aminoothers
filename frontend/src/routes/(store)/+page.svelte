<script lang="ts">
	import { resolve } from '$app/paths';
	import ProductCard from '#lib/components/store/ProductCard.svelte';
	import Icon, { type IconName } from '#lib/components/ui/Icon.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const catalogPath = resolve('productos');
	const categories = $derived(data.categories.filter((c) => c.productCount > 0).slice(0, 6));
	// Las imágenes del hero son las fotos reales de los productos más recientes.
	const showcase = $derived(data.latest.filter((p) => p.primaryImageFileId).slice(0, 3));
	// Columnas según la cantidad, para que la última fila no quede con una tarjeta sola.
	const categoryCols = $derived(
		categories.length === 4
			? 'lg:grid-cols-4'
			: categories.length >= 3
				? 'lg:grid-cols-3'
				: 'lg:grid-cols-2'
	);

	const benefits: ReadonlyArray<{ icon: IconName; title: string; text: string }> = [
		{
			icon: 'truck',
			title: 'Entrega a domicilio',
			text: 'Le compartimos la guía para que siga su pedido.'
		},
		{
			icon: 'banknote',
			title: 'Pago contra entrega',
			text: 'Pague en efectivo cuando reciba su pedido.'
		},
		{
			icon: 'refresh',
			title: 'Transferencia bancaria',
			text: 'Reservamos sus productos mientras paga.'
		},
		{
			icon: 'lock',
			title: 'Compra protegida',
			text: 'Precios confirmados antes de pagar y datos cifrados.'
		}
	];
</script>

<!-- Los enlaces a categorías se arman sobre catalogPath, resuelto con resolve(). -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

<svelte:head>
	<title>{data.info.tradeName} · Tienda en línea</title>
	<meta
		name="description"
		content="Compre en línea en {data.info
			.tradeName}. Entrega a domicilio y pago por transferencia o en efectivo al recibir."
	/>
</svelte:head>

<!-- Hero -->
<section class="mx-auto max-w-7xl px-4 pt-10 pb-16 sm:px-6 sm:pt-16 lg:pb-24">
	<div class="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
		<div class="animate-fade-up">
			<p class="eyebrow">{data.info.tradeName}</p>
			<h1
				class="mt-5 text-[2.75rem] leading-[1.02] font-normal tracking-[-0.035em] sm:text-6xl lg:text-7xl"
			>
				Lo que necesita, <span class="text-stone-400">en la puerta de su casa.</span>
			</h1>
			<p class="mt-6 max-w-md text-base text-stone-600 sm:text-lg">
				Compre en minutos, reciba a domicilio y pague como prefiera: transferencia o efectivo al
				recibir.
			</p>
			<div class="mt-9 flex flex-wrap gap-3">
				<a href={catalogPath} class="btn btn-primary min-h-12 px-7"
					>Comprar ahora <Icon name="arrowRight" class="size-4" /></a
				>
				{#if data.offers.length > 0}
					<a href="#ofertas" class="btn btn-secondary min-h-12 px-7">Ver ofertas</a>
				{:else}
					<a href={resolve('categorias')} class="btn btn-secondary min-h-12 px-7">Categorías</a>
				{/if}
			</div>
			{#if data.total > 0}
				<p class="mt-10 text-sm text-stone-500">
					<span class="font-display text-2xl font-medium text-stone-950 tabular-nums"
						>{data.total}</span
					>
					productos disponibles en el catálogo
				</p>
			{/if}
		</div>

		{#if showcase.length > 0}
			<div class="grid grid-cols-2 gap-3 sm:gap-4" aria-hidden="true">
				{#each showcase as product, i (product.id)}
					<div
						class="flex items-center justify-center overflow-hidden rounded-3xl {[
							'row-span-2 aspect-[4/5] h-full bg-sunken',
							'aspect-square bg-stone-200/60',
							'aspect-square bg-white ring-1 ring-stone-200'
						][i]}"
					>
						<img
							src="/media/{product.primaryImageFileId}"
							alt=""
							class="size-full object-contain p-8 mix-blend-multiply"
							fetchpriority={i === 0 ? 'high' : 'auto'}
						/>
					</div>
				{/each}
			</div>
		{:else}
			<div
				class="flex aspect-[5/4] flex-col justify-end rounded-3xl bg-stone-900 p-8 text-stone-300 sm:p-10"
			>
				<Icon name="bag" class="size-10 text-white" strokeWidth={1.25} />
				<p class="mt-6 font-display text-3xl font-light tracking-tight text-white sm:text-4xl">
					Comprar en línea nunca fue tan simple.
				</p>
				<p class="mt-3 text-sm">Catálogo, carrito y seguimiento de su pedido en un solo lugar.</p>
			</div>
		{/if}
	</div>
</section>

<!-- Beneficios -->
<section aria-label="Beneficios de comprar en línea" class="border-y border-stone-200 bg-white">
	<ul
		class="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-stone-200 px-4 sm:grid-cols-2 sm:divide-y-0 sm:px-6 lg:grid-cols-4 lg:divide-x"
	>
		{#each benefits as item (item.title)}
			<li class="flex gap-4 py-6 lg:px-6 lg:first:pl-0">
				<Icon name={item.icon} class="mt-0.5 size-5 text-stone-900" strokeWidth={1.5} />
				<div>
					<p class="font-medium text-stone-950">{item.title}</p>
					<p class="mt-0.5 text-sm text-stone-500">{item.text}</p>
				</div>
			</li>
		{/each}
	</ul>
</section>

<div class="mx-auto flex max-w-7xl flex-col gap-24 px-4 pt-20 sm:px-6">
	{#if categories.length > 0}
		<section aria-labelledby="home-categories">
			<div class="mb-8 flex items-end justify-between gap-4">
				<div>
					<p class="eyebrow">Explore</p>
					<h2 id="home-categories" class="mt-2 text-3xl sm:text-4xl">Comprar por categoría</h2>
				</div>
				<a href={resolve('categorias')} class="link hidden text-sm sm:inline">Ver todas</a>
			</div>
			<ul class="grid grid-cols-2 gap-3 sm:gap-4 {categoryCols}">
				{#each categories as category, i (category.id)}
					<li>
						<a
							href="{catalogPath}?categoria={category.slug}"
							class="group relative flex h-full min-h-36 flex-col justify-between overflow-hidden rounded-2xl p-5 transition-colors duration-300 sm:min-h-48 sm:p-7 {i ===
							0
								? 'bg-stone-900 text-white hover:bg-stone-800'
								: 'bg-sunken text-stone-950 hover:bg-stone-200/70'}"
						>
							{#if category.imageFileId}
								<img
									src="/media/{category.imageFileId}"
									alt=""
									loading="lazy"
									class="absolute right-4 bottom-4 size-20 object-contain opacity-90 transition-transform duration-500 ease-out-soft group-hover:scale-105 sm:size-28 {i ===
									0
										? ''
										: 'mix-blend-multiply'}"
								/>
							{/if}
							<span
								class="relative font-display text-xl font-medium tracking-tight sm:text-2xl {i === 0
									? 'text-white'
									: ''}">{category.name}</span
							>
							<span
								class="relative mt-6 flex items-center gap-2 text-sm {i === 0
									? 'text-stone-300'
									: 'text-stone-500'}"
							>
								{category.productCount}
								{category.productCount === 1 ? 'producto' : 'productos'}
								<Icon
									name="arrowRight"
									class="size-4 transition-transform duration-300 group-hover:translate-x-1"
								/>
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section aria-labelledby="home-latest">
		<div class="mb-8 flex items-end justify-between gap-4">
			<div>
				<p class="eyebrow">Recién llegados</p>
				<h2 id="home-latest" class="mt-2 text-3xl sm:text-4xl">Novedades</h2>
			</div>
			<a href="{catalogPath}?orden=newest" class="link text-sm">Ver todo</a>
		</div>
		{#if data.latest.length === 0}
			<p class="rounded-2xl bg-sunken px-6 py-16 text-center text-stone-600">
				El catálogo estará disponible próximamente.
			</p>
		{:else}
			<ul class="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
				{#each data.latest as product, i (product.id)}
					<li><ProductCard {product} eager={i < 4} /></li>
				{/each}
			</ul>
		{/if}
	</section>

	{#if data.offers.length > 0}
		<section
			id="ofertas"
			aria-labelledby="home-offers"
			class="-mx-4 scroll-mt-32 bg-white px-4 py-16 sm:-mx-6 sm:rounded-3xl sm:px-10 sm:py-14"
		>
			<div class="mb-8 flex items-end justify-between gap-4">
				<div>
					<p class="eyebrow flex items-center gap-2 text-accent-700!">
						<Icon name="tag" class="size-3.5" /> Por tiempo limitado
					</p>
					<h2 id="home-offers" class="mt-2 text-3xl sm:text-4xl">Ofertas</h2>
				</div>
			</div>
			<ul class="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
				{#each data.offers as product (product.id)}
					<li><ProductCard {product} /></li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
