<script lang="ts">
	import { resolve } from '$app/paths';
	import ListFilters from '#lib/components/admin/ListFilters.svelte';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import { formatDateTime, USER_STATUS_LABELS, USER_STATUS_TONES } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<PageHeading title="Clientes" description="Clientes registrados en la tienda." />

<ListFilters search={data.search} status={data.status} />

{#if data.result.items.length === 0}
	<EmptyState title="No hay clientes que coincidan con la búsqueda" />
{:else}
	<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead
				class="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
			>
				<tr>
					<th class="px-4 py-3">Cliente</th>
					<th class="px-4 py-3">Teléfono</th>
					<th class="px-4 py-3">Estado</th>
					<th class="px-4 py-3">Registro</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.result.items as customer (customer.id)}
					<tr class="hover:bg-slate-50">
						<td class="px-4 py-3">
							<a
								href={resolve(`admin/clientes/${customer.id}`)}
								class="font-medium text-teal-800 hover:underline"
							>
								{customer.firstName}
								{customer.lastName}
							</a>
							<p class="text-slate-500">{customer.email}</p>
						</td>
						<td class="px-4 py-3 text-slate-700">{customer.phone ?? '—'}</td>
						<td class="px-4 py-3">
							<Badge tone={USER_STATUS_TONES[customer.status]}
								>{USER_STATUS_LABELS[customer.status]}</Badge
							>
							{#if !customer.emailVerified}<Badge tone="warning">Correo sin confirmar</Badge>{/if}
						</td>
						<td class="px-4 py-3 text-slate-600">{formatDateTime(customer.createdAt)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="mt-4">
		<Pagination
			basePath={resolve('admin/clientes')}
			page={data.result.page}
			pageSize={data.result.pageSize}
			total={data.result.total}
		/>
	</div>
{/if}
