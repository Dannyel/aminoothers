<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';

	let {
		form
	}: {
		form: { messages?: string[]; values?: { email?: string } } | null | undefined;
	} = $props();

	let submitting = $state(false);
</script>

<form
	method="post"
	class="flex flex-col gap-4"
	use:enhance={() => {
		submitting = true;
		return async ({ update }) => {
			await update({ reset: false });
			submitting = false;
		};
	}}
>
	<Alert variant="error" messages={form?.messages} />
	<TextField
		label="Correo electrónico"
		name="email"
		type="email"
		autocomplete="email"
		required
		value={form?.values?.email ?? ''}
	/>
	<TextField
		label="Contraseña"
		name="password"
		type="password"
		autocomplete="current-password"
		required
	/>
	<div class="text-right text-sm">
		<a href={resolve('recuperar-contrasena')} class="text-teal-700 hover:underline"
			>¿Olvidó su contraseña?</a
		>
	</div>
	<Button type="submit" loading={submitting}>Iniciar sesión</Button>
</form>
