<script lang="ts">
	import { enhance } from '$app/forms';
	import RecoveryCodes from '#lib/components/RecoveryCodes.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';

	let {
		enrollment,
		form,
		loginHref
	}: {
		enrollment: { secret: string; qrSvg: string } | null;
		form:
			| { messages?: string[]; expired?: boolean; recoveryCodes?: string[]; next?: string }
			| null
			| undefined;
		loginHref: string;
	} = $props();

	let submitting = $state(false);
	const groupedSecret = $derived(enrollment?.secret.match(/.{1,4}/g)?.join(' ') ?? '');
</script>

<!-- loginHref llega resuelto desde la página y next es una ruta interna validada en el servidor. -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

{#if form?.recoveryCodes}
	<Alert variant="success" messages="El doble factor quedó configurado." />
	<div class="mt-4"><RecoveryCodes codes={form.recoveryCodes} /></div>
	<a
		href={form.next}
		class="mt-6 inline-flex rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
		>Ya los guardé, continuar</a
	>
{:else if form?.expired}
	<Alert variant="error" messages={form.messages} />
	<a href={loginHref} class="mt-4 inline-block font-medium text-teal-700 hover:underline"
		>Volver a iniciar sesión</a
	>
{:else if enrollment}
	<ol class="flex list-decimal flex-col gap-4 pl-5 text-sm text-slate-700">
		<li>
			Instale una app autenticadora en su teléfono (Google Authenticator, Microsoft Authenticator,
			Authy…).
		</li>
		<li>
			Escanee este código con la app:
			<!-- SVG generado en el servidor por la librería qrcode a partir del secreto. -->
			<div class="mt-3 w-48 rounded-md border border-slate-200 bg-white p-2">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html enrollment.qrSvg}
			</div>
			<p class="mt-2 text-xs text-slate-500">
				¿No puede escanearlo? Ingrese esta clave: <span class="font-mono text-slate-800 select-all"
					>{groupedSecret}</span
				>
			</p>
		</li>
		<li>Escriba el código de 6 dígitos que muestra la app.</li>
	</ol>
	<form
		method="post"
		class="mt-6 flex flex-col gap-4"
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
			label="Código de 6 dígitos"
			name="code"
			inputmode="numeric"
			autocomplete="one-time-code"
			maxlength={7}
			required
		/>
		<Button type="submit" loading={submitting}>Activar y continuar</Button>
	</form>
{/if}
