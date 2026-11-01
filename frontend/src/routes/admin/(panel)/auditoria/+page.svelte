<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import { auditActionLabel, auditModuleLabel, formatDateTime } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const field =
		'rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600';
</script>

<PageHeading
	title="Auditoría"
	description="Operaciones del personal e inicios de sesión: quién, qué, sobre qué registro, con qué datos y desde qué IP. El registro no se puede modificar ni borrar."
/>

<form method="get" class="mb-4 grid gap-3 sm:grid-cols-6 sm:items-end" role="search">
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Módulo</span>
		<select name="module" value={data.filters.module} class={field}>
			<option value="">Todos</option>
			{#each data.options.modules as m (m)}
				<option value={m}>{auditModuleLabel(m)}</option>
			{/each}
		</select>
	</label>
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Usuario</span>
		<select name="userId" value={data.filters.userId} class={field}>
			<option value="">Todos</option>
			{#each data.options.users as u (u.id)}
				<option value={u.id}>{u.name}</option>
			{/each}
		</select>
	</label>
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Id del registro</span>
		<input name="entityId" value={data.filters.entityId} maxlength={64} class={field} />
	</label>
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Acción o ruta</span>
		<input type="search" name="search" value={data.filters.search} maxlength={100} class={field} />
	</label>
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Desde</span>
		<input type="date" name="from" value={data.filters.from} class={field} />
	</label>
	<div class="flex items-end gap-2">
		<label class="flex flex-1 flex-col gap-1 text-sm">
			<span class="font-medium text-slate-700">Hasta</span>
			<input type="date" name="to" value={data.filters.to} class={field} />
		</label>
		<button
			class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
			>Filtrar</button
		>
	</div>
</form>

{#if data.logs.items.length === 0}
	<EmptyState title="No hay registros que coincidan" />
{:else}
	<ul class="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
		{#each data.logs.items as log (log.id)}
			<li class="px-4 py-3">
				<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
					<p>
						<span class="font-medium text-slate-900">{auditActionLabel(log.action)}</span>
						<span class="text-slate-500">· {auditModuleLabel(log.module)}</span>
						{#if log.action.startsWith('LOGIN_FAILED') || log.action === 'ACCOUNT_LOCKED'}
							<span class="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800"
								>Seguridad</span
							>
						{/if}
					</p>
					<p class="text-xs text-slate-500">{formatDateTime(log.createdAt)}</p>
				</div>
				<p class="mt-0.5 text-slate-600">
					{log.user ? `${log.user.name} (${log.user.email})` : 'Usuario desconocido'}
					{#if log.ip}<span class="text-slate-400"> · IP {log.ip}</span>{/if}
				</p>
				{#if log.route}<p class="font-mono text-xs break-all text-slate-500">
						{log.route}{log.entityId ? ` · ${log.entityId}` : ''}
					</p>{/if}
				{#if log.changes && Object.keys(log.changes).length > 0}
					<details class="mt-2">
						<summary class="cursor-pointer text-xs text-teal-800">Ver datos</summary>
						<pre
							class="mt-2 max-h-80 overflow-auto rounded bg-slate-50 p-3 text-xs whitespace-pre-wrap text-slate-700">{JSON.stringify(
								log.changes,
								null,
								2
							)}</pre>
						{#if log.userAgent}<p class="mt-1 text-xs break-all text-slate-400">
								{log.userAgent}
							</p>{/if}
					</details>
				{/if}
			</li>
		{/each}
	</ul>
	<div class="mt-4">
		<Pagination
			basePath={resolve('admin/auditoria')}
			page={data.logs.page}
			pageSize={data.logs.pageSize}
			total={data.logs.total}
		/>
	</div>
{/if}
