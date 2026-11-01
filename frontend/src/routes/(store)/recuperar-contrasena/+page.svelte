<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import AuthCard from '#lib/components/AuthCard.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let submitting = $state(false);
</script>

<AuthCard
	title="Recuperar contraseña"
	subtitle="Le enviaremos un enlace para definir una nueva contraseña."
>
	{#if form && 'success' in form}
		<Alert variant="success" messages={form.success} />
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
			<TextField
				label="Correo electrónico"
				name="email"
				type="email"
				autocomplete="email"
				required
				value={form && 'values' in form ? form.values?.email : ''}
			/>
			<Button type="submit" loading={submitting}>Enviar enlace</Button>
		</form>
	{/if}
	{#snippet footer()}
		<a href={resolve('login')} class="text-teal-700 hover:underline">Volver a iniciar sesión</a>
	{/snippet}
</AuthCard>
