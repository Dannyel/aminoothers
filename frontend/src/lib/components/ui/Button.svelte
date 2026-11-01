<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

	let {
		variant = 'primary',
		loading = false,
		disabled,
		children,
		class: className = '',
		...rest
	}: HTMLButtonAttributes & { variant?: Variant; loading?: boolean; children: Snippet } = $props();

	const variants: Record<Variant, string> = {
		primary: 'bg-teal-700 text-white hover:bg-teal-800 focus-visible:outline-teal-700',
		secondary:
			'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-slate-400',
		danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600',
		ghost: 'text-slate-700 hover:bg-slate-100 focus-visible:outline-slate-400'
	};
</script>

<button
	{...rest}
	disabled={disabled || loading}
	aria-busy={loading}
	class="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 {variants[
		variant
	]} {className}"
>
	{#if loading}
		<span
			class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
			aria-hidden="true"
		></span>
	{/if}
	{@render children()}
</button>
