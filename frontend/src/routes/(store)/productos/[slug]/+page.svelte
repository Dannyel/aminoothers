<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import AvailabilityBadge from '#lib/components/store/AvailabilityBadge.svelte';
	import Price from '#lib/components/store/Price.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { formatDateTime, formatMoney, SALE_CONDITION_LABELS } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const product = $derived(data.product);
	let selected = $state(0);
	const image = $derived(product.images[selected] ?? product.images[0]);
	let submitting = $state(false);
	const catalogPath = resolve('productos');

	const facts = $derived(
		[
			['Presentación', product.presentation],
			['Concentración', product.concentration],
			['Principio activo', product.activeIngredients.join(', ') || null],
			['Marca', product.brand?.name ?? null],
			['Fabricante', product.manufacturer],
			['Registro sanitario', product.sanitaryRegistration],
			['Condición de venta', SALE_CONDITION_LABELS[product.saleCondition]]
		].filter((f): f is [string, string] => Boolean(f[1]))
	);
</script>

<!-- Las migas se arman sobre catalogPath, resuelto con resolve(). -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

<svelte:head>
	<title>{product.name} · {data.info.tradeName}</title>
	{#if product.shortDescription}<meta name="description" content={product.shortDescription} />{/if}
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-8">
	<nav class="mb-4 text-sm text-slate-500" aria-label="Ruta">
		<a href={catalogPath} class="hover:underline">Catálogo</a> /
		<a href="{catalogPath}?categoria={product.category.slug}" class="hover:underline"
			>{product.category.name}</a
		>
		{#if product.subcategory}
			/ <a
				href="{catalogPath}?categoria={product.category.slug}&subcategoria={product.subcategory
					.slug}"
				class="hover:underline">{product.subcategory.name}</a
			>
		{/if}
	</nav>

	<div class="grid gap-8 md:grid-cols-2">
		<div>
			<div
				class="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white"
			>
				{#if image}
					<img
						src="/media/{image.fileId}"
						alt={image.altText ?? product.name}
						class="size-full object-contain"
					/>
				{:else}
					<span class="text-sm text-slate-400">Sin imagen</span>
				{/if}
			</div>
			{#if product.images.length > 1}
				<ul class="mt-3 flex gap-2 overflow-x-auto">
					{#each product.images as img, i (img.fileId)}
						<li>
							<button
								type="button"
								onclick={() => (selected = i)}
								aria-label="Ver imagen {i + 1}"
								aria-pressed={i === selected}
								class="size-16 overflow-hidden rounded-md border {i === selected
									? 'border-teal-600'
									: 'border-slate-200'} bg-white"
							>
								<img src="/media/{img.fileId}" alt="" class="size-full object-contain" />
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div class="flex flex-col gap-4">
			<div>
				{#if product.brand}<p class="text-sm text-slate-500">{product.brand.name}</p>{/if}
				<h1 class="text-2xl font-semibold text-slate-900">{product.name}</h1>
				{#if product.shortDescription}
					<p class="mt-1 text-slate-600">{product.shortDescription}</p>
				{/if}
			</div>
			<div class="flex items-center gap-3">
				<Price price={product.price} promotion={product.promotion} size="lg" />
				<AvailabilityBadge availability={product.availability} />
			</div>
			{#if product.promotion}
				<p class="text-sm text-red-700">
					{product.promotion.name}: ahorra {formatMoney(product.promotion.discount)} hasta el {formatDateTime(
						product.promotion.endsAt
					)}.
				</p>
			{/if}
			<p class="text-xs text-slate-500">Precio con IVA incluido.</p>

			{#if data.flash}
				<Alert variant={data.flash.type} messages={data.flash.message} />
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
					class="flex items-end gap-3"
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
					<label class="flex flex-col gap-1 text-sm">
						<span class="font-medium text-slate-700">Cantidad</span>
						<select
							name="quantity"
							class="rounded-md border-slate-300 text-sm focus:border-teal-600 focus:ring-teal-600"
						>
							{#each Array.from({ length: product.maxQuantity }, (_, i) => i + 1) as n (n)}
								<option value={n}>{n}</option>
							{/each}
						</select>
					</label>
					<Button type="submit" loading={submitting}>Agregar al carrito</Button>
				</form>
			{:else if product.availability === 'OUT_OF_STOCK'}
				<p class="text-sm text-slate-600">Producto agotado por el momento.</p>
			{:else}
				<p class="text-sm text-slate-600">
					Este producto no está disponible para la venta en línea.
				</p>
			{/if}

			{#if facts.length > 0}
				<dl
					class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm"
				>
					{#each facts as [label, value] (label)}
						<dt class="text-slate-500">{label}</dt>
						<dd class="text-slate-800">{value}</dd>
					{/each}
				</dl>
			{/if}

			{#if product.description}
				<section>
					<h2 class="mb-1 font-semibold text-slate-900">Descripción</h2>
					<p class="text-sm whitespace-pre-line text-slate-700">{product.description}</p>
				</section>
			{/if}
			<p class="text-xs text-slate-500">
				Lea las indicaciones del empaque. Ante cualquier duda, consulte a un profesional de la
				salud.
			</p>
		</div>
	</div>
</div>
