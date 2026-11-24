<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '#lib/components/ui/Icon.svelte';

	let { title, children }: { title: string; children: Snippet } = $props();
</script>

<svelte:head>
	<title>{title} · Panel administrativo</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-stone-950 px-4 py-10">
	<div class="w-full max-w-md">
		<p class="mb-8 flex items-center justify-center gap-2.5 font-display font-medium text-white">
			<span
				class="flex size-8 items-center justify-center rounded-lg bg-white font-semibold text-stone-950"
				aria-hidden="true">A</span
			>
			Panel administrativo
		</p>
		<div class="rounded-3xl bg-white p-8 sm:p-10">
			<h1 class="text-3xl">{title}</h1>
			<div class="mt-8">{@render children()}</div>
		</div>
		<p class="mt-6 flex items-center justify-center gap-1.5 text-xs text-stone-400">
			<Icon name="lock" class="size-3.5" /> Acceso exclusivo del personal · Doble factor obligatorio
		</p>
	</div>
</div>
