<script lang="ts">
	import { resolve } from '$app/paths';
	import type { StoreProduct } from '#lib/api/types.ts';
	import AvailabilityBadge from './AvailabilityBadge.svelte';
	import Price from './Price.svelte';

	let { product }: { product: StoreProduct } = $props();
	const details = $derived(
		[product.presentation, product.concentration].filter(Boolean).join(' · ')
	);
</script>

<article
	class="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition hover:shadow-md"
>
	<a href={resolve(`productos/${product.slug}`)} class="flex flex-1 flex-col">
		<div class="relative flex aspect-square items-center justify-center bg-slate-100">
			{#if product.promotion}
				<span
					class="absolute top-2 left-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white"
					>Oferta</span
				>
			{/if}
			{#if product.primaryImageFileId}
				<img
					src="/media/{product.primaryImageFileId}"
					alt={product.name}
					loading="lazy"
					class="size-full object-contain"
				/>
			{:else}
				<span class="text-xs text-slate-400">Sin imagen</span>
			{/if}
		</div>
		<div class="flex flex-1 flex-col gap-1 p-3">
			{#if product.brand}<p class="text-xs text-slate-500">{product.brand.name}</p>{/if}
			<h3 class="text-sm font-medium text-slate-900">{product.name}</h3>
			{#if details}<p class="text-xs text-slate-500">{details}</p>{/if}
			<div class="mt-auto flex items-end justify-between gap-2 pt-2">
				<Price price={product.price} promotion={product.promotion} />
				<AvailabilityBadge availability={product.availability} />
			</div>
		</div>
	</a>
</article>
