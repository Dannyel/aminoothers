<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';

	/** Progreso de la compra: 0 = carrito, 1 = entrega y pago, 2 = confirmación. */
	let { current }: { current: 0 | 1 | 2 } = $props();
	const STEPS = ['Carrito', 'Entrega y pago', 'Confirmación'] as const;
</script>

<nav aria-label="Progreso de la compra" class="mb-10">
	<ol class="flex items-center gap-2 text-sm sm:gap-3">
		{#each STEPS as step, i (step)}
			<li
				class="flex items-center gap-2 sm:gap-3"
				aria-current={i === current ? 'step' : undefined}
			>
				<span
					class="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums {i <
					current
						? 'bg-stone-900 text-white'
						: i === current
							? 'bg-stone-900 text-white ring-4 ring-stone-200'
							: 'border border-stone-300 text-stone-500'}"
				>
					{#if i < current}<Icon name="check" class="size-3.5" strokeWidth={2.5} />{:else}{i +
							1}{/if}
				</span>
				<span
					class="{i === current ? 'font-medium text-stone-950' : 'text-stone-500'} {i === current
						? ''
						: 'hidden sm:inline'}">{step}</span
				>
				{#if i < STEPS.length - 1}
					<span
						class="h-px w-6 sm:w-12 {i < current ? 'bg-stone-900' : 'bg-stone-300'}"
						aria-hidden="true"
					></span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>
