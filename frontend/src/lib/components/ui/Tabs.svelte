<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Pestañas accesibles (patrón WAI-ARIA): flechas, Inicio y Fin mueven el foco
	 * entre pestañas, y solo la activa entra en el orden de tabulación.
	 */
	let {
		id,
		tabs
	}: { id: string; tabs: ReadonlyArray<{ key: string; label: string; content: Snippet }> } =
		$props();

	let active = $state(0);
	const buttons: HTMLButtonElement[] = [];

	function onKeydown(event: KeyboardEvent) {
		const last = tabs.length - 1;
		const next =
			event.key === 'ArrowRight'
				? (active + 1) % tabs.length
				: event.key === 'ArrowLeft'
					? (active - 1 + tabs.length) % tabs.length
					: event.key === 'Home'
						? 0
						: event.key === 'End'
							? last
							: null;
		if (next === null) return;
		event.preventDefault();
		active = next;
		buttons[next]?.focus();
	}
</script>

<div>
	<div
		role="tablist"
		tabindex="-1"
		class="flex [scrollbar-width:none] gap-6 overflow-x-auto border-b border-stone-200"
		onkeydown={onKeydown}
	>
		{#each tabs as tab, i (tab.key)}
			<button
				bind:this={buttons[i]}
				type="button"
				role="tab"
				id="{id}-tab-{tab.key}"
				aria-selected={i === active}
				aria-controls="{id}-panel-{tab.key}"
				tabindex={i === active ? 0 : -1}
				onclick={() => (active = i)}
				class="-mb-px min-h-11 border-b-2 text-sm whitespace-nowrap transition-colors duration-200 {i ===
				active
					? 'border-stone-900 font-medium text-stone-950'
					: 'border-transparent text-stone-500 hover:text-stone-900'}"
			>
				{tab.label}
			</button>
		{/each}
	</div>
	{#each tabs as tab, i (tab.key)}
		<div
			role="tabpanel"
			id="{id}-panel-{tab.key}"
			aria-labelledby="{id}-tab-{tab.key}"
			tabindex="0"
			hidden={i !== active}
			class="pt-6 focus-visible:outline-offset-4"
		>
			{@render tab.content()}
		</div>
	{/each}
</div>
