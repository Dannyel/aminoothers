<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children }: { title: string; children?: Snippet } = $props();
</script>

<div class="rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center">
	<p class="font-medium text-slate-800">{title}</p>
	{#if children}<div class="mt-2 text-sm text-slate-600">{@render children()}</div>{/if}
</div>
