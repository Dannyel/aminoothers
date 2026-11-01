<script lang="ts">
	import type { Lot } from '#lib/api/types.ts';
	import Badge from '#lib/components/ui/Badge.svelte';
	import { LOT_STATUS_LABELS, LOT_STATUS_TONES } from '#lib/utils/labels.ts';

	let { lot }: { lot: Lot } = $props();
</script>

<span class="inline-flex flex-wrap gap-1">
	<Badge tone={LOT_STATUS_TONES[lot.status]}>{LOT_STATUS_LABELS[lot.status]}</Badge>
	{#if lot.isExpired}
		<Badge tone="danger">Vencido</Badge>
	{:else if lot.belowShelfLife}
		<Badge tone="warning">Sin vida útil para vender</Badge>
	{:else if lot.isNearExpiry}
		<Badge tone="warning">Próximo a vencer</Badge>
	{/if}
</span>
