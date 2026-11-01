<script lang="ts">
	import { resolve } from '$app/paths';
	import ListFilters from '#lib/components/admin/ListFilters.svelte';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import { can, formatDateTime, USER_STATUS_LABELS, USER_STATUS_TONES } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<PageHeading title="Usuarios" description="Personal con acceso al panel administrativo.">
	{#snippet actions()}
		{#if can(data.staff, 'users.manage')}
			<a
				href={resolve('admin/usuarios/nuevo')}
				class="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
				>Nuevo usuario</a
			>
		{/if}
	{/snippet}
</PageHeading>

<ListFilters search={data.search} status={data.status} />

{#if data.result.items.length === 0}
	<EmptyState title="No hay usuarios que coincidan con la búsqueda" />
{:else}
	<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead
				class="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
			>
				<tr>
					<th class="px-4 py-3">Nombre</th>
					<th class="px-4 py-3">Roles</th>
					<th class="px-4 py-3">Estado</th>
					<th class="px-4 py-3">Último acceso</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.result.items as user (user.id)}
					<tr class="hover:bg-slate-50">
						<td class="px-4 py-3">
							<a
								href={resolve(`admin/usuarios/${user.id}`)}
								class="font-medium text-teal-800 hover:underline"
							>
								{user.firstName}
								{user.lastName}
							</a>
							<p class="text-slate-500">{user.email}</p>
						</td>
						<td class="px-4 py-3 text-slate-700">
							{user.roles.map((r) => r.name).join(', ') || '—'}
						</td>
						<td class="px-4 py-3">
							<Badge tone={USER_STATUS_TONES[user.status]}>{USER_STATUS_LABELS[user.status]}</Badge>
							{#if user.lockedUntil}<Badge tone="warning">Bloqueo temporal</Badge>{/if}
						</td>
						<td class="px-4 py-3 text-slate-600">{formatDateTime(user.lastLoginAt)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="mt-4">
		<Pagination
			basePath={resolve('admin/usuarios')}
			page={data.result.page}
			pageSize={data.result.pageSize}
			total={data.result.total}
		/>
	</div>
{/if}
