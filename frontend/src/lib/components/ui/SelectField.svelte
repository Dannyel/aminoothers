<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';

	let {
		label,
		name,
		options,
		placeholder,
		id = name,
		value = $bindable(),
		...rest
	}: HTMLSelectAttributes & {
		label: string;
		name: string;
		options: ReadonlyArray<{ value: string; label: string }>;
		placeholder?: string;
	} = $props();
</script>

<div class="flex flex-col gap-1.5">
	<label for={id} class="text-sm font-semibold text-stone-700">
		{label}
		{#if rest.required}<span class="text-red-600" aria-hidden="true">*</span>{/if}
	</label>
	<select
		{id}
		{name}
		bind:value
		class="rounded-lg border-stone-300 text-sm shadow-sm focus:border-brand-600 focus:ring-brand-600"
		{...rest}
	>
		{#if placeholder}<option value="">{placeholder}</option>{/if}
		{#each options as option (option.value)}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
</div>
