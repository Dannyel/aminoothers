<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const profile = $derived(data.profile);
	let submitting = $state(false);
</script>

<PageHeading title="Mi perfil" description={profile.email} />

<div class="flex flex-col gap-4">
	<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
	<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />

	{#if !profile.emailVerified}
		<div
			class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
		>
			<p>Confirme su correo electrónico para poder realizar compras.</p>
			<form method="post" action="?/resendVerification" use:enhance>
				<Button type="submit" variant="secondary">Reenviar enlace</Button>
			</form>
		</div>
	{/if}

	<form
		method="post"
		action="?/update"
		class="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update({ reset: false });
				submitting = false;
			};
		}}
	>
		<div class="grid gap-4 sm:grid-cols-2">
			<TextField
				label="Nombre"
				name="firstName"
				required
				maxlength={100}
				value={profile.firstName}
			/>
			<TextField
				label="Apellido"
				name="lastName"
				required
				maxlength={100}
				value={profile.lastName}
			/>
			<TextField label="Teléfono" name="phone" type="tel" value={profile.phone ?? ''} />
			<TextField
				label="Fecha de nacimiento"
				name="birthDate"
				type="date"
				value={profile.birthDate ?? ''}
			/>
		</div>
		<fieldset class="grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2">
			<legend class="mb-2 text-sm font-medium text-slate-800">Datos de facturación</legend>
			<TextField
				label="NIT"
				name="taxId"
				value={profile.taxId}
				hint="Escriba CF si es consumidor final."
			/>
			<TextField
				label="Nombre para la factura"
				name="taxName"
				maxlength={200}
				value={profile.taxName ?? ''}
			/>
		</fieldset>
		<div><Button type="submit" loading={submitting}>Guardar cambios</Button></div>
	</form>
</div>
