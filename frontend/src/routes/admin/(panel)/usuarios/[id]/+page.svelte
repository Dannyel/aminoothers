<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import RoleCheckboxes from '#lib/components/admin/RoleCheckboxes.svelte';
	import MfaResetButton from '#lib/components/admin/MfaResetButton.svelte';
	import StatusActions from '#lib/components/admin/StatusActions.svelte';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';
	import { can, formatDateTime, USER_STATUS_LABELS, USER_STATUS_TONES } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const user = $derived(data.user);
	const canManage = $derived(can(data.staff, 'users.manage'));
	const isSelf = $derived(user.id === data.staff.id);
	const fullName = $derived(`${user.firstName} ${user.lastName}`);
</script>

<PageHeading title={fullName} description={user.email}>
	{#snippet actions()}
		<a
			href={resolve('admin/usuarios')}
			class="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-200">← Volver</a
		>
	{/snippet}
</PageHeading>

<div class="flex flex-col gap-6">
	{#if data.created}
		<Alert
			variant="success"
			messages="Usuario creado. Se le envió un correo para definir su contraseña."
		/>
	{/if}
	<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
	<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />

	<section
		class="flex flex-wrap gap-x-8 gap-y-2 rounded-lg border border-slate-200 bg-white p-6 text-sm"
	>
		<p>
			Estado:
			<Badge tone={USER_STATUS_TONES[user.status]}>{USER_STATUS_LABELS[user.status]}</Badge>
			{#if user.lockedUntil}
				<Badge tone="warning">Bloqueo temporal hasta {formatDateTime(user.lockedUntil)}</Badge>
			{/if}
		</p>
		<p>
			Doble factor:
			<Badge tone={user.mfaEnabled ? 'success' : 'warning'}
				>{user.mfaEnabled ? 'Configurado' : 'Pendiente de configurar'}</Badge
			>
		</p>
		<p>Último acceso: {formatDateTime(user.lastLoginAt)}</p>
		<p>Creado: {formatDateTime(user.createdAt)}</p>
	</section>

	{#if canManage}
		<section class="rounded-lg border border-slate-200 bg-white p-6">
			<h2 class="font-medium text-slate-900">Datos</h2>
			<form
				method="post"
				action="?/update"
				class="mt-4 grid max-w-2xl gap-4 sm:grid-cols-2"
				use:enhance={() =>
					async ({ update }) =>
						update({ reset: false })}
			>
				<TextField
					label="Nombre"
					name="firstName"
					required
					maxlength={100}
					value={user.firstName}
				/>
				<TextField
					label="Apellido"
					name="lastName"
					required
					maxlength={100}
					value={user.lastName}
				/>
				<TextField label="Teléfono" name="phone" type="tel" value={user.phone ?? ''} />
				<div class="sm:col-span-2"><Button type="submit">Guardar datos</Button></div>
			</form>
		</section>

		<section class="rounded-lg border border-slate-200 bg-white p-6">
			<h2 class="font-medium text-slate-900">Roles</h2>
			{#if isSelf}
				<p class="mt-1 text-sm text-slate-600">No puede modificar sus propios roles.</p>
			{/if}
			<form
				method="post"
				action="?/roles"
				class="mt-4 flex flex-col gap-4"
				use:enhance={() =>
					async ({ update }) =>
						update({ reset: false })}
			>
				<RoleCheckboxes
					roles={data.roles}
					selected={user.roles.map((r) => r.id)}
					disabled={isSelf}
				/>
				{#if !isSelf}<div><Button type="submit">Guardar roles</Button></div>{/if}
			</form>
		</section>

		{#if !isSelf}
			<section class="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
				<h2 class="font-medium text-slate-900">Acceso</h2>
				<StatusActions status={user.status} name={fullName} />
				<MfaResetButton name={fullName} />
				{#if user.status === 'ACTIVE'}
					<form method="post" action="?/passwordReset" use:enhance>
						<Button type="submit" variant="secondary">Enviar enlace para definir contraseña</Button>
					</form>
				{/if}
			</section>
		{/if}
	{:else}
		<section class="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-700">
			Roles: {user.roles.map((r) => r.name).join(', ') || '—'}
		</section>
	{/if}
</div>
