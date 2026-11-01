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

<div class="flex flex-col gap-1">
	<label for={id} class="text-sm font-medium text-slate-700">
		{label}
		{#if rest.required}<span class="text-red-600" aria-hidden="true">*</span>{/if}
	</label>
	<select
		{id}
		{name}
		bind:value
		class="rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600"
		{...rest}
	>
		{#if placeholder}<option value="">{placeholder}</option>{/if}
		{#each options as option (option.value)}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
</div>
