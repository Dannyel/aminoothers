<script lang="ts">
	import type { StoreProduct } from '#lib/api/types.ts';
	import { formatMoney } from '#lib/utils/labels.ts';

	let {
		price,
		promotion,
		size = 'base'
	}: { price: string; promotion: StoreProduct['promotion']; size?: 'base' | 'lg' } = $props();

	const percent = $derived(
		promotion && Number(price) > 0
			? Math.round((Number(promotion.discount) / Number(price)) * 100)
			: 0
	);
	const main = $derived(
		size === 'lg'
			? 'font-display text-3xl font-medium tracking-tight'
			: 'text-[0.9375rem] font-semibold'
	);
</script>

{#if promotion}
	<span class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 tabular-nums">
		<span class="{main} text-accent-700">
			<span class="sr-only">Precio de oferta:</span>{formatMoney(promotion.price)}
		</span>
		<s class="text-stone-500 {size === 'lg' ? 'text-base' : 'text-sm'}">
			<span class="sr-only">Precio normal:</span>{formatMoney(price)}
		</s>
		{#if percent > 0 && size === 'lg'}
			<span class="rounded-full bg-accent-50 px-2 py-0.5 text-xs font-semibold text-accent-800"
				>−{percent} %</span
			>
		{/if}
	</span>
{:else}
	<span class="{main} text-stone-950 tabular-nums">{formatMoney(price)}</span>
{/if}
