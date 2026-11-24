<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
	let { tone = 'neutral', children }: { tone?: Tone; children: Snippet } = $props();

	// El color siempre acompaña a un texto: nunca transmite el estado por sí solo.
	const tones: Record<Tone, string> = {
		neutral: 'bg-stone-100 text-stone-700 ring-stone-200',
		success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
		warning: 'bg-amber-50 text-amber-900 ring-amber-200',
		danger: 'bg-red-50 text-red-800 ring-red-200',
		info: 'bg-sky-50 text-sky-800 ring-sky-200'
	};
	const dots: Record<Tone, string> = {
		neutral: 'bg-stone-400',
		success: 'bg-emerald-500',
		warning: 'bg-amber-500',
		danger: 'bg-red-500',
		info: 'bg-sky-500'
	};
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset {tones[
		tone
	]}"
>
	<span class="size-1.5 rounded-full {dots[tone]}" aria-hidden="true"></span>
	{@render children()}
</span>
