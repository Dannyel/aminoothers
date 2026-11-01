<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children }: { title: string; children: Snippet } = $props();
</script>

<svelte:head>
	<title>{title} · Panel administrativo</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
	<div class="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
		<p class="text-sm font-medium text-teal-700">Farmacia en línea · Panel administrativo</p>
		<h1 class="mt-1 text-xl font-semibold text-slate-900">{title}</h1>
		<div class="mt-6">{@render children()}</div>
	</div>
</div>
