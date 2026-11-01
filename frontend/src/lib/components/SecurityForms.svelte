<script lang="ts">
	import { enhance } from '$app/forms';
	import type { MfaStatus } from '#lib/api/types.ts';
	import RecoveryCodes from '#lib/components/RecoveryCodes.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ConfirmButton from '#lib/components/ui/ConfirmButton.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';
	import { formatDateTime } from '#lib/utils/labels.ts';

	let {
		form,
		mfa
	}: {
		form:
			| { section?: string; success?: string; messages?: string[]; recoveryCodes?: string[] }
			| null
			| undefined;
		mfa: MfaStatus;
	} = $props();

	let submitting = $state(false);
	const passwordForm = $derived(form?.section === 'password' ? form : null);
	const mfaForm = $derived(form?.section === 'mfa' ? form : null);
</script>

<div class="flex flex-col gap-6">
	<section class="rounded-lg border border-slate-200 bg-white p-6">
		<h2 class="font-medium text-slate-900">Cambiar contraseña</h2>
		<p class="mt-1 text-sm text-slate-600">Al cambiarla se cierran sus otras sesiones.</p>
		<form
			method="post"
			action="?/changePassword"
			class="mt-4 flex max-w-md flex-col gap-4"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
		>
			<Alert variant="success" messages={passwordForm?.success} />
			<Alert variant="error" messages={passwordForm?.messages} />
			<TextField
				label="Contraseña actual"
				name="currentPassword"
				type="password"
				autocomplete="current-password"
				required
			/>
			<TextField
				label="Nueva contraseña"
				name="newPassword"
				type="password"
				autocomplete="new-password"
				required
				minlength={10}
				hint="Mínimo 10 caracteres, con al menos una letra y un número."
			/>
			<TextField
				label="Confirmar nueva contraseña"
				name="newPasswordConfirm"
				type="password"
				autocomplete="new-password"
				required
			/>
			<div><Button type="submit" loading={submitting}>Actualizar contraseña</Button></div>
		</form>
	</section>

	<section class="rounded-lg border border-slate-200 bg-white p-6">
		<h2 class="font-medium text-slate-900">Doble factor</h2>
		<p class="mt-1 text-sm text-slate-600">
			Activo desde {formatDateTime(mfa.enabledAt)}. Le quedan
			<strong>{mfa.recoveryCodesRemaining}</strong> código(s) de recuperación.
		</p>
		{#if mfaForm?.recoveryCodes}
			<div class="mt-4 max-w-md"><RecoveryCodes codes={mfaForm.recoveryCodes} /></div>
		{:else}
			<form
				method="post"
				action="?/regenerateCodes"
				class="mt-4 flex max-w-md flex-col gap-4"
				use:enhance
			>
				<Alert variant="error" messages={mfaForm?.messages} />
				<p class="text-sm text-slate-600">
					Para generar códigos nuevos (los anteriores dejarán de servir), ingrese el código actual
					de su app autenticadora.
				</p>
				<TextField
					label="Código de 6 dígitos"
					name="code"
					inputmode="numeric"
					autocomplete="one-time-code"
					maxlength={7}
					required
				/>
				<div><Button type="submit" variant="secondary">Generar códigos nuevos</Button></div>
			</form>
		{/if}
		<p class="mt-4 text-xs text-slate-500">
			Si cambia de teléfono y perdió los códigos, pida a la farmacia que restablezca su doble
			factor.
		</p>
	</section>

	<section class="rounded-lg border border-slate-200 bg-white p-6">
		<h2 class="font-medium text-slate-900">Sesiones</h2>
		<p class="mt-1 text-sm text-slate-600">
			Si usó su cuenta en un equipo ajeno, cierre la sesión en todos los dispositivos.
		</p>
		<form method="post" action="?/logoutAll" class="mt-4">
			<ConfirmButton
				message="Se cerrará su sesión en todos los dispositivos, incluido este. ¿Continuar?"
				confirmLabel="Cerrar todas"
			>
				Cerrar todas las sesiones
			</ConfirmButton>
		</form>
	</section>
</div>
