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
	class="m-auto w-full max-w-md rounded-lg p-6 shadow-xl backdrop:bg-slate-900/40"
>
	<p class="text-sm text-slate-700">{message}</p>
	<div class="mt-6 flex justify-end gap-2">
		<Button type="button" variant="secondary" onclick={() => dialog.close()}>Cancelar</Button>
		<Button type="submit" {variant} {formaction} {name} {value} onclick={() => dialog.close()}>
			{confirmLabel}
		</Button>
	</div>
</dialog>
