<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		label,
		name,
		hint,
		id = name,
		value = $bindable(),
		...rest
	}: HTMLInputAttributes & { label: string; name: string; hint?: string } = $props();
</script>

<div class="flex flex-col gap-1.5">
	<label for={id} class="text-sm font-semibold text-stone-700">
		{label}
		{#if rest.required}<span class="text-red-600" aria-hidden="true">*</span>{/if}
	</label>
	<input
		{id}
		{name}
		bind:value
		aria-describedby={hint ? `${id}-hint` : undefined}
		class="rounded-lg border-stone-300 text-sm shadow-sm focus:border-brand-600 focus:ring-brand-600 disabled:bg-stone-100"
		{...rest}
	/>
	{#if hint}<p id="{id}-hint" class="text-xs text-stone-600">{hint}</p>{/if}
</div>
