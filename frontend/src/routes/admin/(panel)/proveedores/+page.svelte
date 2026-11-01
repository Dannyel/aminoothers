<script lang="ts">
	import { resolve } from '$app/paths';
	import SupplierForm from '#lib/components/admin/SupplierForm.svelte';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import { can } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<PageHeading title="Proveedores" />

<div class="flex flex-col gap-4">
	<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
	<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />

	<form method="get" class="flex flex-wrap items-end gap-3" role="search">
		<label class="flex min-w-60 flex-1 flex-col gap-1 text-sm">
			<span class="font-medium text-slate-700">Buscar por nombre o NIT</span>
			<input
				type="search"
				name="search"
				value={data.search}
				maxlength={100}
				class="rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600"
			/>
		</label>
		<button
			class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
			>Buscar</button
		>
	</form>

	{#if data.suppliers.items.length === 0}
		<EmptyState title="No hay proveedores registrados" />
	{:else}
		<ul class="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
			{#each data.suppliers.items as supplier (supplier.id)}
				<li class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
					<div>
						<a
							href={resolve(`admin/proveedores/${supplier.id}`)}
							class="font-medium text-teal-800 hover:underline">{supplier.name}</a
						>
						{#if !supplier.isActive}<Badge>Inactivo</Badge>{/if}
						<p class="text-sm text-slate-500">
							{supplier.taxId ? `NIT ${supplier.taxId}` : 'Sin NIT'}
							{#if supplier.phone}· {supplier.phone}{/if}
						</p>
					</div>
					<span class="text-sm text-slate-600">{supplier.purchaseOrderCount} orden(es)</span>
				</li>
			{/each}
		</ul>
		<Pagination
			basePath={resolve('admin/proveedores')}
			page={data.suppliers.page}
			pageSize={data.suppliers.pageSize}
			total={data.suppliers.total}
		/>
	{/if}

	{#if can(data.staff, 'purchases.manage')}
		<details class="flex flex-col gap-3">
			<summary class="cursor-pointer text-sm font-medium text-teal-700">Agregar proveedor</summary>
			<div class="mt-3"><SupplierForm action="?/create" submitLabel="Agregar proveedor" /></div>
		</details>
	{/if}
</div>
