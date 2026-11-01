<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import PermissionPicker from '#lib/components/admin/PermissionPicker.svelte';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ConfirmButton from '#lib/components/ui/ConfirmButton.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';
	import { can } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const role = $derived(data.role);
	const editable = $derived(can(data.staff, 'roles.manage') && !role.isSuperAdmin);
</script>

<PageHeading title={role.name} description={role.code}>
	{#snippet actions()}
		<a
			href={resolve('admin/roles')}
			class="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-200">← Volver</a
		>
	{/snippet}
</PageHeading>

<div class="flex max-w-2xl flex-col gap-6">
	<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
	<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />

	{#if role.isSuperAdmin}
		<Alert
			variant="info"
			messages="El superadministrador tiene todos los permisos y no se puede modificar."
		/>
	{/if}

	<form
		method="post"
		action="?/update"
		class="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6"
		use:enhance={() =>
			async ({ update }) =>
				update({ reset: false })}
	>
		<TextField
			label="Nombre"
			name="name"
			required
			maxlength={100}
			value={role.name}
			disabled={!editable}
		/>
		<TextField
			label="Descripción"
			name="description"
			maxlength={500}
			value={role.description ?? ''}
			disabled={!editable}
		/>
		<PermissionPicker
			permissions={data.permissions}
			selected={role.permissions}
			disabled={!editable}
		/>
		{#if editable}<div><Button type="submit">Guardar cambios</Button></div>{/if}
	</form>

	{#if editable && !role.isSystem}
		<form method="post" action="?/remove" use:enhance>
			<ConfirmButton message="¿Eliminar el rol «{role.name}»?" confirmLabel="Eliminar">
				Eliminar rol
			</ConfirmButton>
			{#if role.userCount > 0}
				<p class="mt-2 text-sm text-slate-600">
					Tiene {role.userCount} usuario(s) asignado(s); quíteselo antes de eliminarlo.
				</p>
			{/if}
		</form>
	{/if}
</div>
