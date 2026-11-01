<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import SupplierForm from '#lib/components/admin/SupplierForm.svelte';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import ConfirmButton from '#lib/components/ui/ConfirmButton.svelte';
	import { can } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const canManage = $derived(can(data.staff, 'purchases.manage'));
</script>

<PageHeading
	title={data.supplier.name}
	description="{data.supplier.purchaseOrderCount} orden(es) de compra"
>
	{#snippet actions()}
		<a
			href={resolve(`admin/compras?supplierId=${data.supplier.id}`)}
			class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
			>Ver órdenes</a
		>
		<a
			href={resolve('admin/proveedores')}
			class="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-200">← Volver</a
		>
	{/snippet}
</PageHeading>

<div class="flex max-w-3xl flex-col gap-4">
	<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
	<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />
	<SupplierForm
		supplier={data.supplier}
		action="?/update"
		submitLabel="Guardar"
		disabled={!canManage}
	/>
	{#if canManage}
		<form method="post" action="?/remove" use:enhance>
			<ConfirmButton
				message="¿Dar de baja al proveedor «{data.supplier.name}»?"
				confirmLabel="Dar de baja"
			>
				Dar de baja
			</ConfirmButton>
		</form>
	{/if}
</div>
