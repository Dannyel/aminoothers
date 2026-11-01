<script lang="ts">
	import { resolve } from '$app/paths';
	import MfaResetButton from '#lib/components/admin/MfaResetButton.svelte';
	import StatusActions from '#lib/components/admin/StatusActions.svelte';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { can, formatDateTime, USER_STATUS_LABELS, USER_STATUS_TONES } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const customer = $derived(data.customer);
	const fullName = $derived(`${customer.firstName} ${customer.lastName}`);
</script>

<PageHeading title={fullName} description={customer.email}>
	{#snippet actions()}
		<a
			href={resolve('admin/clientes')}
			class="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-200">← Volver</a
		>
	{/snippet}
</PageHeading>

<div class="flex flex-col gap-6">
	<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
	<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />

	<section
		class="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 text-sm sm:grid-cols-2"
	>
		<div>
			<p class="text-slate-500">Estado</p>
			<p class="mt-1 flex flex-wrap gap-1">
				<Badge tone={USER_STATUS_TONES[customer.status]}
					>{USER_STATUS_LABELS[customer.status]}</Badge
				>
				{#if !customer.emailVerified}<Badge tone="warning">Correo sin confirmar</Badge>{/if}
				{#if !customer.mfaEnabled}<Badge tone="warning">Doble factor pendiente</Badge>{/if}
			</p>
		</div>
		<div>
			<p class="text-slate-500">Teléfono</p>
			<p class="mt-1">{customer.phone ?? '—'}</p>
		</div>
		<div>
			<p class="text-slate-500">NIT / nombre de facturación</p>
			<p class="mt-1">{customer.taxId} · {customer.taxName ?? '—'}</p>
		</div>
		<div>
			<p class="text-slate-500">Registro / último acceso</p>
			<p class="mt-1">
				{formatDateTime(customer.createdAt)} · {formatDateTime(customer.lastLoginAt)}
			</p>
		</div>
	</section>

	{#if can(data.staff, 'customers.manage')}
		<section class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-6">
			<h2 class="font-medium text-slate-900">Acceso a la tienda</h2>
			<StatusActions status={customer.status} name={fullName} />
			<MfaResetButton name={fullName} />
		</section>
	{/if}

	<section>
		<h2 class="mb-3 font-medium text-slate-900">Direcciones</h2>
		{#if customer.addresses.length === 0}
			<EmptyState title="Sin direcciones registradas" />
		{:else}
			<ul class="grid gap-4 sm:grid-cols-2">
				{#each customer.addresses as address (address.id)}
					<li class="rounded-lg border border-slate-200 bg-white p-4 text-sm">
						<p class="font-medium text-slate-900">
							{address.label}
							{#if address.isDefault}<Badge tone="info">Predeterminada</Badge>{/if}
						</p>
						<address class="mt-1 text-slate-600 not-italic">
							{address.recipientName} · {address.phone}<br />
							{address.addressLine1}{address.addressLine2 ? `, ${address.addressLine2}` : ''}<br />
							{address.zone ? `Zona ${address.zone}, ` : ''}{address.municipality}, {address.department}
						</address>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>
