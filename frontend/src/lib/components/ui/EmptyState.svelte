<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from './Icon.svelte';

	let {
		title,
		icon = 'inbox',
		children
	}: { title: string; icon?: IconName; children?: Snippet } = $props();
</script>

<div class="flex flex-col items-center rounded-3xl bg-sunken px-6 py-16 text-center">
	<span class="flex size-14 items-center justify-center rounded-full bg-white text-stone-900">
		<Icon name={icon} class="size-6" strokeWidth={1.5} />
	</span>
	<p class="mt-5 font-display text-xl font-medium text-stone-950">{title}</p>
	{#if children}<div class="mt-2 max-w-md text-sm text-stone-600">{@render children()}</div>{/if}
</div>
