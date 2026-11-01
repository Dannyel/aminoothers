<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
	let { tone = 'neutral', children }: { tone?: Tone; children: Snippet } = $props();

	const tones: Record<Tone, string> = {
		neutral: 'bg-slate-100 text-slate-700',
		success: 'bg-emerald-100 text-emerald-800',
		warning: 'bg-amber-100 text-amber-900',
		danger: 'bg-red-100 text-red-800',
		info: 'bg-sky-100 text-sky-800'
	};
</script>

<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {tones[tone]}">
	{@render children()}
</span>
