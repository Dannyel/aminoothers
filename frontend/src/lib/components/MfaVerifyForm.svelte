<script lang="ts">
	import { enhance } from '$app/forms';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';

	let {
		form,
		loginHref
	}: {
		form:
			| { messages?: string[]; expired?: boolean; values?: { useRecovery?: boolean } }
			| null
			| undefined;
		loginHref: string;
	} = $props();

	let useRecovery = $derived(form?.values?.useRecovery ?? false);
	let submitting = $state(false);
</script>

<!-- loginHref llega resuelto desde la página. -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

{#if form?.expired}
	<Alert variant="error" messages={form.messages} />
	<a href={loginHref} class="mt-4 inline-block font-medium text-teal-700 hover:underline"
		>Volver a iniciar sesión</a
	>
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
		<Alert variant="error" messages={form?.messages} />
		<input type="hidden" name="method" value={useRecovery ? 'recovery' : 'totp'} />
		{#if useRecovery}
			<TextField
				label="Código de recuperación"
				name="recoveryCode"
				autocomplete="off"
				required
				maxlength={20}
				placeholder="ABCDE-FGHIJ"
			/>
		{:else}
			<TextField
				label="Código de 6 dígitos"
				name="code"
				inputmode="numeric"
				autocomplete="one-time-code"
				maxlength={7}
				required
				hint="Ábralo en su app autenticadora (Google Authenticator, Microsoft Authenticator…)."
			/>
		{/if}
		<Button type="submit" loading={submitting}>Verificar</Button>
		<button
			type="button"
			class="text-sm text-teal-700 hover:underline"
			onclick={() => (useRecovery = !useRecovery)}
		>
			{useRecovery
				? 'Usar el código de la app'
				: '¿Perdió su teléfono? Use un código de recuperación'}
		</button>
	</form>
{/if}
