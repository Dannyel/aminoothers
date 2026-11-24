<script lang="ts">
	import { resolve } from '$app/paths';
	import type { StoreProduct } from '#lib/api/types.ts';
	import Icon from '#lib/components/ui/Icon.svelte';
	import AvailabilityBadge from './AvailabilityBadge.svelte';
	import Price from './Price.svelte';

	let { product, eager = false }: { product: StoreProduct; eager?: boolean } = $props();
	const details = $derived(
		[product.presentation, product.concentration].filter(Boolean).join(' · ')
	);
	const unavailable = $derived(
		product.availability === 'OUT_OF_STOCK' || product.availability === 'NOT_FOR_SALE'
	);
</script>

<article class="group relative flex h-full flex-col">
	<div
		class="relative aspect-[4/5] overflow-hidden rounded-2xl bg-sunken transition-colors duration-300 group-hover:bg-stone-200/70"
	>
		{#if product.primaryImageFileId}
			<img
				src="/media/{product.primaryImageFileId}"
				alt=""
				loading={eager ? 'eager' : 'lazy'}
				decoding="async"
				width="400"
				height="500"
				class="size-full object-contain p-6 mix-blend-multiply transition-transform duration-500 ease-out-soft group-hover:scale-[1.04] sm:p-8 {unavailable
					? 'opacity-50'
					: ''}"
			/>
		{:else}
			<span class="flex size-full items-center justify-center text-stone-400">
				<Icon name="image" class="size-8" strokeWidth={1.25} />
			</span>
		{/if}
		{#if product.promotion}
			<span
				class="absolute top-3 left-3 rounded-full bg-accent-700 px-2.5 py-1 text-[0.6875rem] font-semibold tracking-wide text-white uppercase"
				>Oferta</span
			>
		{/if}
	</div>
	<div class="flex flex-1 flex-col gap-1 pt-3.5">
		{#if product.brand}
			<p class="text-xs tracking-wide text-stone-500 uppercase">{product.brand.name}</p>
		{/if}
		<h3 class="font-sans text-[0.9375rem] leading-snug font-medium text-stone-950">
			<!-- El enlace cubre toda la tarjeta con ::after, sin anidar elementos interactivos. -->
			<a
				href={resolve(`productos/${product.slug}`)}
				class="line-clamp-2 decoration-stone-400 underline-offset-4 group-hover:underline after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-stone-900"
				>{product.name}</a
			>
		</h3>
		{#if details}<p class="line-clamp-1 text-sm text-stone-500">{details}</p>{/if}
		<div class="mt-auto flex flex-col gap-1 pt-2">
			<Price price={product.price} promotion={product.promotion} />
			<AvailabilityBadge availability={product.availability} quiet />
		</div>
	</div>
</article>
