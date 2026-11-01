<script lang="ts">
	import { enhance } from '$app/forms';
	import ConfirmButton from '#lib/components/ui/ConfirmButton.svelte';

	/** Restablece el doble factor de otro usuario (acción ?/mfaReset). */
	let { name }: { name: string } = $props();
</script>

<form method="post" action="?/mfaReset" use:enhance>
	<ConfirmButton
		variant="secondary"
		message="Use esta opción solo si {name} perdió su teléfono y sus códigos de recuperación, y confirmó su identidad. Se cerrarán sus sesiones y deberá configurar el doble factor de nuevo al ingresar. ¿Continuar?"
		confirmLabel="Restablecer"
	>
		Restablecer doble factor
	</ConfirmButton>
</form>
