<script lang="ts">
	import type { StoreProduct } from '#lib/api/types.ts';
	import { formatMoney } from '#lib/utils/labels.ts';

	let {
		price,
		promotion,
		size = 'base'
	}: { price: string; promotion: StoreProduct['promotion']; size?: 'base' | 'lg' } = $props();
</script>

{#if promotion}
	<span class="flex flex-wrap items-baseline gap-x-2">
		<span class="font-semibold text-red-700 {size === 'lg' ? 'text-2xl' : ''}"
			>{formatMoney(promotion.price)}</span
		>
		<s class="text-sm text-slate-500">{formatMoney(price)}</s>
	</span>
{:else}
	<span class="font-semibold text-slate-900 {size === 'lg' ? 'text-2xl' : ''}"
		>{formatMoney(price)}</span
	>
{/if}
