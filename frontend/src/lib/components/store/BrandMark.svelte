<script lang="ts">
	/** Identidad de la tienda: el logotipo configurado o un monograma con la inicial. */
	let {
		name,
		logoFileId,
		inverse = false
	}: { name: string; logoFileId: string | null; inverse?: boolean } = $props();
	const initial = $derived(name.trim().charAt(0).toUpperCase() || 'T');
</script>

<span class="flex items-center gap-2.5">
	{#if logoFileId}
		<img src="/media/{logoFileId}" alt="" class="h-9 w-auto" />
	{:else}
		<span
			class="flex size-9 items-center justify-center rounded-lg font-display text-lg font-semibold {inverse
				? 'bg-white text-stone-950'
				: 'bg-stone-900 text-white'}"
			aria-hidden="true">{initial}</span
		>
	{/if}
	<span
		class="font-display text-lg font-semibold tracking-tight {inverse
			? 'text-white'
			: 'text-stone-950'}">{name}</span
	>
</span>
