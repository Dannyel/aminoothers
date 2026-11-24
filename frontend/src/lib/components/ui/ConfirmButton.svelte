<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';

	/**
	 * Botón que pide confirmación antes de enviar su formulario. Debe ir dentro
	 * de un <form>; el botón "Confirmar" del diálogo es el que envía.
	 */
	let {
		message,
		confirmLabel = 'Confirmar',
		variant = 'danger',
		formaction,
		name,
		value,
		children
	}: {
		message: string;
		confirmLabel?: string;
		variant?: 'primary' | 'secondary' | 'danger';
		formaction?: string;
		name?: string;
		value?: string;
		children: Snippet;
	} = $props();

	let dialog: HTMLDialogElement;
</script>

<Button type="button" {variant} onclick={() => dialog.showModal()}>
	{@render children()}
</Button>

<dialog
	bind:this={dialog}
	class="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl p-7 shadow-raised backdrop:bg-stone-950/50 backdrop:backdrop-blur-sm open:animate-fade-up"
>
	<p class="text-stone-800">{message}</p>
	<div class="mt-8 flex flex-wrap justify-end gap-2">
		<Button type="button" variant="secondary" onclick={() => dialog.close()}>Cancelar</Button>
		<Button type="submit" {variant} {formaction} {name} {value} onclick={() => dialog.close()}>
			{confirmLabel}
		</Button>
	</div>
</dialog>
