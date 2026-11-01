<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import RoleCheckboxes from '#lib/components/admin/RoleCheckboxes.svelte';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let submitting = $state(false);
</script>

<PageHeading
	title="Nuevo usuario"
	description="El usuario recibirá un correo para definir su contraseña."
/>

<form
	method="post"
	class="flex max-w-2xl flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6"
	use:enhance={() => {
		submitting = true;
		return async ({ update }) => {
			await update({ reset: false });
			submitting = false;
		};
	}}
>
	<Alert variant="error" messages={form?.messages} />
	<div class="grid gap-4 sm:grid-cols-2">
		<TextField
			label="Nombre"
			name="firstName"
			required
			maxlength={100}
			value={form?.values?.firstName ?? ''}
		/>
		<TextField
			label="Apellido"
			name="lastName"
			required
			maxlength={100}
			value={form?.values?.lastName ?? ''}
		/>
		<TextField
			label="Correo electrónico"
			name="email"
			type="email"
			required
			value={form?.values?.email ?? ''}
		/>
		<TextField label="Teléfono" name="phone" type="tel" value={form?.values?.phone ?? ''} />
	</div>
	<RoleCheckboxes roles={data.roles} selected={form?.values?.roleIds ?? []} />
	<div class="flex gap-2">
		<Button type="submit" loading={submitting}>Crear usuario</Button>
		<a
			href={resolve('admin/usuarios')}
			class="rounded-md px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Cancelar</a
		>
	</div>
</form>
