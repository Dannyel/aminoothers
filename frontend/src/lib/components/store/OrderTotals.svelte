<script lang="ts">
	import { formatMoney } from '#lib/utils/labels.ts';

	let {
		subtotal,
		discountTotal,
		shippingCost,
		taxTotal,
		total
	}: {
		subtotal: string;
		discountTotal: string;
		/** null mientras no se elige el envío. */
		shippingCost: string | null;
		taxTotal: string;
		total: string;
	} = $props();
</script>

<dl class="flex flex-col gap-3 text-sm tabular-nums">
	<div class="flex justify-between gap-4">
		<dt class="text-stone-600">Subtotal</dt>
		<dd class="text-stone-950">{formatMoney(subtotal)}</dd>
	</div>
	{#if Number(discountTotal) > 0}
		<div class="flex justify-between gap-4 text-accent-800">
			<dt>Descuentos</dt>
			<dd>−{formatMoney(discountTotal)}</dd>
		</div>
	{/if}
	<div class="flex justify-between gap-4">
		<dt class="text-stone-600">Envío</dt>
		<dd class="text-right text-stone-950">
			{shippingCost === null
				? 'Se calcula en el siguiente paso'
				: Number(shippingCost) === 0
					? 'Gratis'
					: formatMoney(shippingCost)}
		</dd>
	</div>
	<div
		class="mt-1 flex items-baseline justify-between gap-4 border-t border-stone-200 pt-4 text-stone-950"
	>
		<dt class="font-medium">Total</dt>
		<dd class="font-display text-2xl font-medium tracking-tight">{formatMoney(total)}</dd>
	</div>
	<div class="-mt-1 flex justify-between gap-4 text-xs text-stone-500">
		<dt>IVA incluido</dt>
		<dd>{formatMoney(taxTotal)}</dd>
	</div>
</dl>
