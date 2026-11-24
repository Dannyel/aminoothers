<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
	type Size = 'sm' | 'md' | 'lg';

	let {
		variant = 'primary',
		size = 'md',
		loading = false,
		disabled,
		children,
		class: className = '',
		...rest
	}: HTMLButtonAttributes & {
		variant?: Variant;
		size?: Size;
		loading?: boolean;
		children: Snippet;
	} = $props();

	const variants: Record<Variant, string> = {
		primary: 'bg-stone-900 text-white hover:bg-stone-700 active:bg-stone-950',
		secondary:
			'border border-stone-300 bg-white text-stone-900 hover:border-stone-900 active:bg-stone-100',
		danger: 'bg-red-700 text-white hover:bg-red-800 active:bg-red-900',
		ghost: 'text-stone-700 hover:bg-stone-100 hover:text-stone-950 active:bg-stone-200'
	};
	// md y lg cumplen el área táctil mínima de 44 px de alto en pantallas táctiles.
	const sizes: Record<Size, string> = {
		sm: 'min-h-9 px-4 text-sm',
		md: 'min-h-10 px-5 text-sm pointer-coarse:min-h-11',
		lg: 'min-h-12 px-7 text-[0.9375rem]'
	};
</script>

<button
	{...rest}
	disabled={disabled || loading}
	aria-busy={loading}
	class="inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 {variants[
		variant
	]} {sizes[size]} {className}"
>
	{#if loading}
		<span
			class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
			aria-hidden="true"
		></span>
	{/if}
	{@render children()}
</button>
