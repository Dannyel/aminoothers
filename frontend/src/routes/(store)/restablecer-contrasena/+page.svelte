<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import AuthCard from '#lib/components/AuthCard.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let submitting = $state(false);
</script>

<AuthCard title="Definir contraseña">
	{#if form && 'success' in form}
		<Alert variant="success" messages={form.success} />
		<a
			href={resolve(form.loginHref ?? 'login')}
			class="mt-4 inline-block font-medium text-teal-700 hover:underline">Iniciar sesión</a
		>
	{:else if !data.token}
		<Alert
			variant="error"
			messages="El enlace no es válido. Solicite uno nuevo desde «Recuperar contraseña»."
		/>
	{:else}
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
			<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />
			<input type="hidden" name="token" value={data.token} />
			<TextField
				label="Nueva contraseña"
				name="password"
				type="password"
				autocomplete="new-password"
				required
				minlength={10}
				hint="Mínimo 10 caracteres, con al menos una letra y un número."
			/>
			<TextField
				label="Confirmar contraseña"
				name="passwordConfirm"
				type="password"
				autocomplete="new-password"
				required
			/>
			<Button type="submit" loading={submitting}>Guardar contraseña</Button>
		</form>
	{/if}
</AuthCard>
