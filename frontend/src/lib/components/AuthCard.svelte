<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		subtitle,
		children,
		footer
	}: { title: string; subtitle?: string; children: Snippet; footer?: Snippet } = $props();
</script>

<svelte:head>
	<title>{title} · Tienda en línea</title>
</svelte:head>

<div class="mx-auto w-full max-w-md px-4 py-14 sm:py-20">
	<div class="animate-fade-up">
		<h1 class="text-4xl">{title}</h1>
		{#if subtitle}<p class="mt-3 text-stone-600">{subtitle}</p>{/if}
		<div class="mt-10">{@render children()}</div>
	</div>
	{#if footer}
		<div class="mt-10 border-t border-stone-200 pt-6 text-center text-sm text-stone-600">
			{@render footer()}
		</div>
	{/if}
</div>
