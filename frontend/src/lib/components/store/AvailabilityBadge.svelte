<script lang="ts">
	import type { Availability } from '#lib/api/types.ts';
	import { AVAILABILITY_LABELS } from '#lib/utils/labels.ts';

	/**
	 * Disponibilidad como texto con un punto de color: el color nunca va solo.
	 * `quiet` oculta el estado normal (Disponible) para no recargar las tarjetas.
	 */
	let { availability, quiet = false }: { availability: Availability; quiet?: boolean } = $props();

	const dots: Record<Availability, string> = {
		AVAILABLE: 'bg-emerald-600',
		LOW_STOCK: 'bg-accent-600',
		OUT_OF_STOCK: 'bg-stone-400',
		PHARMACY_ONLY: 'bg-sky-600',
		NOT_FOR_SALE: 'bg-stone-400'
	};
</script>

{#if !(quiet && availability === 'AVAILABLE')}
	<span
		class="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap text-stone-600"
	>
		<span class="size-1.5 rounded-full {dots[availability]}" aria-hidden="true"></span>
		{AVAILABILITY_LABELS[availability]}
	</span>
{/if}
