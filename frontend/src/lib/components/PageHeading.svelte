<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, description, actions }: { title: string; description?: string; actions?: Snippet } =
		$props();
</script>

<svelte:head>
	<title>{title} · Tienda en línea</title>
</svelte:head>

<div class="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-5">
	<div class="min-w-0">
		<h1 class="text-3xl text-stone-950">{title}</h1>
		{#if description}<p class="mt-1 max-w-3xl text-sm text-stone-600">{description}</p>{/if}
	</div>
	{#if actions}<div class="flex flex-wrap gap-2">{@render actions()}</div>{/if}
</div>
