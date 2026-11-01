<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import PermissionPicker from '#lib/components/admin/PermissionPicker.svelte';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<PageHeading title="Nuevo rol" />

<form
	method="post"
	class="flex max-w-2xl flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6"
	use:enhance={() =>
		async ({ update }) =>
			update({ reset: false })}
>
	<Alert variant="error" messages={form?.messages} />
	<div class="grid gap-4 sm:grid-cols-2">
		<TextField
			label="Código"
			name="code"
			required
			maxlength={50}
			pattern="[A-Za-z][A-Za-z0-9_]+"
			hint="Mayúsculas, números y guion bajo. No se puede cambiar."
			value={form?.values?.code ?? ''}
		/>
		<TextField
			label="Nombre"
			name="name"
			required
			maxlength={100}
			value={form?.values?.name ?? ''}
		/>
	</div>
	<TextField
		label="Descripción"
		name="description"
		maxlength={500}
		value={form?.values?.description ?? ''}
	/>
	<PermissionPicker permissions={data.permissions} selected={form?.values?.permissions ?? []} />
	<div class="flex gap-2">
		<Button type="submit">Crear rol</Button>
		<a
			href={resolve('admin/roles')}
			class="rounded-md px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Cancelar</a
		>
	</div>
</form>
