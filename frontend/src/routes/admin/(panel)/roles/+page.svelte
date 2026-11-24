<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import { can } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<PageHeading title="Roles y permisos" description="Los permisos se validan siempre en el servidor.">
	{#snippet actions()}
		{#if can(data.staff, 'roles.manage')}
			<a
				href={resolve('admin/roles/nuevo')}
				class="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
				>Nuevo rol</a
			>
		{/if}
	{/snippet}
</PageHeading>

<div class="card overflow-x-auto">
	<table class="min-w-full divide-y divide-stone-200 text-sm">
		<thead class="bg-stone-50 text-left text-xs font-medium tracking-wide text-stone-500 uppercase">
			<tr>
				<th class="px-4 py-3">Rol</th>
				<th class="px-4 py-3">Permisos</th>
				<th class="px-4 py-3">Usuarios</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-stone-100">
			{#each data.roles as role (role.id)}
				<tr class="hover:bg-stone-50">
					<td class="px-4 py-3">
						<a
							href={resolve(`admin/roles/${role.id}`)}
							class="font-medium text-brand-800 hover:underline">{role.name}</a
						>
						<span class="ml-1 text-xs text-stone-400">{role.code}</span>
						{#if role.isSystem}<Badge>Sistema</Badge>{/if}
						{#if role.description}<p class="text-stone-500">{role.description}</p>{/if}
					</td>
					<td class="px-4 py-3 text-stone-700">
						{role.isSuperAdmin ? 'Todos' : role.permissions.length}
					</td>
					<td class="px-4 py-3 text-stone-700">{role.userCount}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
