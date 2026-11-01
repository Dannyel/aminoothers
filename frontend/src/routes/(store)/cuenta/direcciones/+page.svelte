<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ConfirmButton from '#lib/components/ui/ConfirmButton.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const MAX_ADDRESSES = 10;
</script>

<PageHeading title="Direcciones de entrega">
	{#snippet actions()}
		{#if data.addresses.length < MAX_ADDRESSES}
			<a
				href={resolve('cuenta/direcciones/nueva')}
				class="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
				>Agregar dirección</a
			>
		{/if}
	{/snippet}
</PageHeading>

<div class="flex flex-col gap-4">
	<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
	<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />

	{#if data.addresses.length === 0}
		<EmptyState title="Aún no tiene direcciones registradas">
			Agregue una dirección para recibir sus pedidos.
		</EmptyState>
	{:else}
		<ul class="grid gap-4 sm:grid-cols-2">
			{#each data.addresses as address (address.id)}
				<li class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
					<div class="flex items-center justify-between gap-2">
						<p class="font-medium text-slate-900">{address.label}</p>
						{#if address.isDefault}<Badge tone="info">Predeterminada</Badge>{/if}
					</div>
					<address class="text-sm text-slate-600 not-italic">
						{address.recipientName} · {address.phone}<br />
						{address.addressLine1}{address.addressLine2 ? `, ${address.addressLine2}` : ''}<br />
						{address.zone ? `Zona ${address.zone}, ` : ''}{address.municipality}, {address.department}
						{#if address.reference}<br /><span class="text-slate-500">{address.reference}</span
							>{/if}
					</address>
					<div class="mt-auto flex flex-wrap gap-2">
						<a
							href={resolve(`cuenta/direcciones/${address.id}`)}
							class="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
							>Editar</a
						>
						{#if !address.isDefault}
							<form method="post" action="?/setDefault" use:enhance>
								<input type="hidden" name="id" value={address.id} />
								<Button type="submit" variant="ghost">Usar como predeterminada</Button>
							</form>
						{/if}
						<form method="post" action="?/remove" use:enhance>
							<input type="hidden" name="id" value={address.id} />
							<ConfirmButton
								message="¿Eliminar la dirección «{address.label}»?"
								confirmLabel="Eliminar"
							>
								Eliminar
							</ConfirmButton>
						</form>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>
