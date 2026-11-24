<script lang="ts">
	import Icon from './Icon.svelte';

	/**
	 * Selector de cantidad con botones − y +. Sin JavaScript queda el campo numérico,
	 * que el navegador limita a [1, max]; el servidor vuelve a validar la cantidad.
	 */
	let {
		name,
		max,
		value = $bindable(1),
		label = 'Cantidad',
		id = name
	}: { name: string; max: number; value?: number; label?: string; id?: string } = $props();

	const clamp = (n: number) => Math.min(Math.max(1, Math.trunc(n) || 1), Math.max(1, max));
	const button =
		'flex size-11 items-center justify-center text-stone-700 transition-colors duration-200 hover:bg-stone-100 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';
</script>

<div>
	<label for={id} class="sr-only">{label}</label>
	<div
		class="inline-flex items-center overflow-hidden rounded-full border border-stone-300 bg-white"
	>
		<button
			type="button"
			class={button}
			disabled={value <= 1}
			onclick={() => (value = clamp(value - 1))}
		>
			<Icon name="minus" class="size-4" />
			<span class="sr-only">Disminuir cantidad</span>
		</button>
		<input
			{id}
			{name}
			type="number"
			inputmode="numeric"
			min="1"
			{max}
			bind:value
			onchange={() => (value = clamp(value))}
			class="w-12 [appearance:textfield] border-0! bg-transparent! p-0 text-center font-medium tabular-nums shadow-none! ring-0! [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
		/>
		<button
			type="button"
			class={button}
			disabled={value >= max}
			onclick={() => (value = clamp(value + 1))}
		>
			<Icon name="plus" class="size-4" />
			<span class="sr-only">Aumentar cantidad</span>
		</button>
	</div>
</div>
