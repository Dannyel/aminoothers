<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import AvailabilityBadge from '#lib/components/store/AvailabilityBadge.svelte';
	import Price from '#lib/components/store/Price.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import QuantityStepper from '#lib/components/ui/QuantityStepper.svelte';
	import Tabs from '#lib/components/ui/Tabs.svelte';
	import { formatDateTime, formatMoney, SALE_CONDITION_LABELS } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const product = $derived(data.product);
	let selected = $state(0);
	const image = $derived(product.images[selected] ?? product.images[0]);
	let submitting = $state(false);
	let quantity = $state(1);
	const catalogPath = resolve('productos');

	const facts = $derived(
		[
			['Marca', product.brand?.name ?? null],
			['Presentación', product.presentation],
			['Concentración', product.concentration],
			['Ingrediente activo', product.activeIngredients.join(', ') || null],
			['Fabricante', product.manufacturer],
			['Registro sanitario', product.sanitaryRegistration],
			['Condición de venta', SALE_CONDITION_LABELS[product.saleCondition]],
			['Categoría', product.subcategory?.name ?? product.category.name]
		].filter((f): f is [string, string] => Boolean(f[1]))
	);

	/** Galería: las flechas cambian de imagen cuando el foco está en las miniaturas. */
	function onThumbKey(event: KeyboardEvent) {
		const count = product.images.length;
		if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
		event.preventDefault();
		selected = (selected + (event.key === 'ArrowRight' ? 1 : -1) + count) % count;
		const list = event.currentTarget as HTMLElement;
		list.querySelectorAll('button')[selected]?.focus();
	}
</script>

<!-- Las migas se arman sobre catalogPath, resuelto con resolve(). -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

<svelte:head>
	<title>{product.name} · {data.info.tradeName}</title>
	{#if product.shortDescription}<meta name="description" content={product.shortDescription} />{/if}
</svelte:head>

{#snippet descriptionTab()}
	{#if product.description}
		<p class="max-w-prose whitespace-pre-line text-stone-700">{product.description}</p>
	{:else if product.shortDescription}
		<p class="max-w-prose text-stone-700">{product.shortDescription}</p>
	{:else}
		<p class="text-stone-500">Este producto aún no tiene una descripción.</p>
	{/if}
{/snippet}

{#snippet detailsTab()}
	<dl class="grid max-w-xl grid-cols-[minmax(8rem,auto)_1fr] text-sm">
		{#each facts as [label, value] (label)}
			<dt class="border-b border-stone-200 py-3 pr-6 text-stone-500">{label}</dt>
			<dd class="border-b border-stone-200 py-3 text-stone-950">{value}</dd>
		{/each}
	</dl>
{/snippet}

{#snippet careTab()}
	<div class="flex max-w-prose flex-col gap-3 text-stone-700">
		<p>
			Lea las indicaciones del empaque. Ante cualquier duda, consulte a un profesional de la salud.
		</p>
		<p class="text-sm text-stone-500">{data.info.regulatoryNotice}</p>
	</div>
{/snippet}

<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
	<nav class="mb-8 text-sm text-stone-500" aria-label="Ruta">
		<ol class="flex flex-wrap items-center gap-1.5">
			<li><a href={catalogPath} class="hover:text-stone-950">Productos</a></li>
			<li aria-hidden="true">/</li>
			<li>
				<a href="{catalogPath}?categoria={product.category.slug}" class="hover:text-stone-950"
					>{product.category.name}</a
				>
			</li>
			{#if product.subcategory}
				<li aria-hidden="true">/</li>
				<li>
					<a
						href="{catalogPath}?categoria={product.category.slug}&subcategoria={product.subcategory
							.slug}"
						class="hover:text-stone-950">{product.subcategory.name}</a
					>
				</li>
			{/if}
		</ol>
	</nav>

	<div class="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
		<!-- Galería -->
		<div class="flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
			{#if product.images.length > 1}
				<div
					class="flex gap-2.5 overflow-x-auto sm:flex-col sm:overflow-visible"
					aria-label="Imágenes del producto"
					role="toolbar"
					tabindex="-1"
					aria-orientation="vertical"
					onkeydown={onThumbKey}
				>
					{#each product.images as img, i (img.fileId)}
						<div>
							<button
								type="button"
								onclick={() => (selected = i)}
								aria-label="Ver imagen {i + 1} de {product.images.length}"
								aria-pressed={i === selected}
								tabindex={i === selected ? 0 : -1}
								class="block size-18 overflow-hidden rounded-xl bg-sunken ring-offset-2 ring-offset-canvas transition duration-200 sm:size-20 {i ===
								selected
									? 'ring-2 ring-stone-900'
									: 'opacity-70 hover:opacity-100'}"
							>
								<img
									src="/media/{img.fileId}"
									alt=""
									class="size-full object-contain p-2 mix-blend-multiply"
								/>
							</button>
						</div>
					{/each}
				</div>
			{/if}
			<div
				class="relative flex aspect-square flex-1 items-center justify-center overflow-hidden rounded-3xl bg-sunken"
			>
				{#if image}
					{#key image.fileId}
						<img
							src="/media/{image.fileId}"
							alt={image.altText ?? product.name}
							class="size-full animate-fade-up object-contain p-10 mix-blend-multiply sm:p-16"
							fetchpriority="high"
						/>
					{/key}
				{:else}
					<span class="flex flex-col items-center gap-2 text-stone-400">
						<Icon name="image" class="size-10" strokeWidth={1.25} />
						<span class="text-sm">Sin imagen</span>
					</span>
				{/if}
				{#if product.promotion}
					<span
						class="absolute top-5 left-5 rounded-full bg-accent-700 px-3 py-1 text-xs font-semibold tracking-wide text-white uppercase"
						>Oferta</span
					>
				{/if}
			</div>
		</div>

		<!-- Información y compra -->
		<div class="lg:sticky lg:top-36 lg:self-start">
			{#if product.brand}
				<a
					href="{catalogPath}?marca={product.brand.slug}"
					class="eyebrow transition-colors duration-200 hover:text-stone-950"
					>{product.brand.name}</a
				>
			{/if}
			<h1 class="mt-3 text-3xl leading-tight sm:text-4xl">{product.name}</h1>
			{#if product.presentation || product.concentration}
				<p class="mt-2 text-stone-500">
					{[product.presentation, product.concentration].filter(Boolean).join(' · ')}
				</p>
			{/if}

			<div class="mt-6 flex flex-col gap-2">
				<Price price={product.price} promotion={product.promotion} size="lg" />
				<p class="text-xs text-stone-500">IVA incluido</p>
			</div>
			{#if product.promotion}
				<p class="mt-3 flex items-start gap-2 text-sm text-accent-800">
					<Icon name="tag" class="mt-0.5 size-4" />
					<span
						>{product.promotion.name}: ahorre {formatMoney(product.promotion.discount)} · válido hasta
						el {formatDateTime(product.promotion.endsAt)}</span
					>
				</p>
			{/if}

			{#if product.shortDescription}
				<p class="mt-6 text-stone-700">{product.shortDescription}</p>
			{/if}

			<div class="mt-8 border-t border-stone-200 pt-8">
				<div class="mb-5"><AvailabilityBadge availability={product.availability} /></div>

				{#if data.flash}
					<div class="mb-5">
						<Alert variant={data.flash.type} messages={data.flash.message} />
					</div>
				{/if}

				{#if product.availability === 'PHARMACY_ONLY'}
					<Alert
						variant="info"
						messages="Este producto requiere receta médica. Por ahora solo se vende en la farmacia; consulte con su médico o farmacéutico."
					/>
				{:else if product.maxQuantity > 0}
					<form
						method="post"
						action="{resolve('carrito')}?/add"
						class="flex flex-wrap items-center gap-3"
						use:enhance={() => {
							submitting = true;
							return async ({ update }) => {
								await update();
								submitting = false;
							};
						}}
					>
						<input type="hidden" name="productId" value={product.id} />
						<input type="hidden" name="redirectTo" value={page.url.pathname} />
						<QuantityStepper name="quantity" max={product.maxQuantity} bind:value={quantity} />
						<Button type="submit" size="lg" class="flex-1" loading={submitting}>
							<Icon name="bag" class="size-4.5" /> Agregar al carrito
						</Button>
					</form>
					{#if product.availability === 'LOW_STOCK'}
						<p class="mt-3 text-sm text-accent-800">
							Quedan pocas unidades: puede agregar hasta {product.maxQuantity}.
						</p>
					{/if}
				{:else if product.availability === 'OUT_OF_STOCK'}
					<p class="rounded-2xl bg-sunken px-5 py-4 text-sm text-stone-700">
						Producto agotado por el momento. Vuelva pronto.
					</p>
				{:else}
					<p class="rounded-2xl bg-sunken px-5 py-4 text-sm text-stone-700">
						Este producto no está disponible para la venta en línea.
					</p>
				{/if}

				<ul class="mt-8 flex flex-col gap-3 text-sm text-stone-600">
					<li class="flex items-center gap-3">
						<Icon name="truck" class="size-4.5 text-stone-900" strokeWidth={1.5} /> Entrega a domicilio
						con número de guía
					</li>
					<li class="flex items-center gap-3">
						<Icon name="banknote" class="size-4.5 text-stone-900" strokeWidth={1.5} /> Pague por transferencia
						o en efectivo al recibir
					</li>
				</ul>
			</div>
		</div>
	</div>

	<section class="mt-20 max-w-4xl" aria-label="Información del producto">
		<Tabs
			id="product-info"
			tabs={[
				{ key: 'descripcion', label: 'Descripción', content: descriptionTab },
				{ key: 'detalles', label: 'Detalles', content: detailsTab },
				{ key: 'uso', label: 'Uso responsable', content: careTab }
			]}
		/>
	</section>
</div>
