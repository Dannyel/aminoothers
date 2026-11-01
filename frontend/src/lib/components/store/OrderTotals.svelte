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

<dl class="flex flex-col gap-2 text-sm">
	<div class="flex justify-between">
		<dt class="text-slate-600">Subtotal</dt>
		<dd>{formatMoney(subtotal)}</dd>
	</div>
	{#if Number(discountTotal) > 0}
		<div class="flex justify-between text-emerald-700">
			<dt>Descuentos</dt>
			<dd>−{formatMoney(discountTotal)}</dd>
		</div>
	{/if}
	<div class="flex justify-between">
		<dt class="text-slate-600">Envío</dt>
		<dd>{shippingCost === null ? 'Se calcula al elegir el envío' : formatMoney(shippingCost)}</dd>
	</div>
	<div class="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
		<dt>Total</dt>
		<dd>{formatMoney(total)}</dd>
	</div>
	<div class="flex justify-between text-xs text-slate-500">
		<dt>IVA incluido</dt>
		<dd>{formatMoney(taxTotal)}</dd>
	</div>
</dl>
