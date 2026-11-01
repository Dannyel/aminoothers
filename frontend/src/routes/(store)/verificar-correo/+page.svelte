<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import AuthCard from '#lib/components/AuthCard.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let submitting = $state(false);
</script>

<AuthCard title="Confirmar correo electrónico">
	{#if form && 'success' in form}
		<Alert variant="success" messages={form.success} />
		<a
			href={resolve(data.user ? 'cuenta/perfil' : 'login')}
			class="mt-4 inline-block font-medium text-teal-700 hover:underline"
			>{data.user ? 'Ir a mi cuenta' : 'Iniciar sesión'}</a
		>
	{:else if !data.token}
		<Alert variant="error" messages="El enlace no es válido." />
	{:else}
		<form
			method="post"
			class="flex flex-col gap-4"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
		>
			<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />
			<input type="hidden" name="token" value={data.token} />
			<p class="text-sm text-slate-600">Presione el botón para confirmar su correo.</p>
			<Button type="submit" loading={submitting}>Confirmar mi correo</Button>
		</form>
	{/if}
</AuthCard>
