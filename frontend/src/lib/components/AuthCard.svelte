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
	<title>{title} · Farmacia en línea</title>
</svelte:head>

<div class="mx-auto w-full max-w-md px-4 py-12">
	<div class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
		<h1 class="text-xl font-semibold text-slate-900">{title}</h1>
		{#if subtitle}<p class="mt-1 text-sm text-slate-600">{subtitle}</p>{/if}
		<div class="mt-6">{@render children()}</div>
	</div>
	{#if footer}<div class="mt-4 text-center text-sm text-slate-600">{@render footer()}</div>{/if}
</div>
