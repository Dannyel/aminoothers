<script lang="ts">
	import { enhance } from '$app/forms';
	import type { UserStatus } from '#lib/api/types.ts';
	import ConfirmButton from '#lib/components/ui/ConfirmButton.svelte';

	/** Botones para cambiar el estado de una cuenta (acción ?/status). */
	let { status, name }: { status: UserStatus; name: string } = $props();
</script>

<form method="post" action="?/status" class="flex flex-wrap gap-2" use:enhance>
	{#if status !== 'ACTIVE'}
		<ConfirmButton
			variant="primary"
			name="status"
			value="ACTIVE"
			message="¿Activar la cuenta de {name}?"
			confirmLabel="Activar">Activar</ConfirmButton
		>
	{/if}
	{#if status !== 'BLOCKED'}
		<ConfirmButton
			name="status"
			value="BLOCKED"
			message="{name} no podrá ingresar y se cerrarán sus sesiones. ¿Bloquear la cuenta?"
			confirmLabel="Bloquear">Bloquear</ConfirmButton
		>
	{/if}
	{#if status !== 'INACTIVE'}
		<ConfirmButton
			variant="secondary"
			name="status"
			value="INACTIVE"
			message="{name} no podrá ingresar y se cerrarán sus sesiones. ¿Desactivar la cuenta?"
			confirmLabel="Desactivar">Desactivar</ConfirmButton
		>
	{/if}
</form>
