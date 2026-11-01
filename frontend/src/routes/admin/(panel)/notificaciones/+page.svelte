<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import {
		formatDateTime,
		formatOrderNumber,
		NOTIFICATION_STATUS_LABELS,
		NOTIFICATION_STATUS_TONES,
		NOTIFICATION_TYPE_LABELS
	} from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const field =
		'rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600';
</script>

<PageHeading
	title="Correos enviados"
	description="Bandeja de salida: cada aviso se guarda junto con la operación que lo origina y se envía en segundo plano, con hasta 5 intentos."
/>

<form method="get" class="mb-4 grid gap-3 sm:grid-cols-4 sm:items-end" role="search">
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Destinatario o asunto</span>
		<input type="search" name="search" value={data.filters.search} maxlength={100} class={field} />
	</label>
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Estado</span>
		<select name="status" value={data.filters.status} class={field}>
			<option value="">Todos</option>
			{#each Object.entries(NOTIFICATION_STATUS_LABELS) as [value, label] (value)}
				<option {value}>{label}</option>
			{/each}
		</select>
	</label>
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Tipo</span>
		<select name="type" value={data.filters.type} class={field}>
			<option value="">Todos</option>
			{#each Object.entries(NOTIFICATION_TYPE_LABELS) as [value, label] (value)}
				<option {value}>{label}</option>
			{/each}
		</select>
	</label>
	<div>
		<button
			class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
			>Filtrar</button
		>
	</div>
</form>

{#if data.notifications.items.length === 0}
	<EmptyState title="No hay correos que coincidan" />
{:else}
	<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead
				class="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
			>
				<tr>
					<th class="px-4 py-3">Correo</th>
					<th class="px-4 py-3">Destinatario</th>
					<th class="px-4 py-3">Estado</th>
					<th class="px-4 py-3">Fecha</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.notifications.items as n (n.id)}
					<tr>
						<td class="px-4 py-3">
							<a
								href={resolve(`admin/notificaciones/${n.id}`)}
								class="font-medium text-teal-800 hover:underline"
								>{n.subject ?? NOTIFICATION_TYPE_LABELS[n.type]}</a
							>
							<p class="text-xs text-slate-500">
								{NOTIFICATION_TYPE_LABELS[n.type]}{n.orderNumber
									? ` · ${formatOrderNumber('PED', n.orderNumber)}`
									: ''}
							</p>
						</td>
						<td class="px-4 py-3 break-all">{n.recipient}</td>
						<td class="px-4 py-3">
							<Badge tone={NOTIFICATION_STATUS_TONES[n.status]}
								>{NOTIFICATION_STATUS_LABELS[n.status]}</Badge
							>
							{#if n.status !== 'SENT' && n.attempts > 0}
								<p class="text-xs text-slate-500">{n.attempts} intento(s)</p>
							{/if}
						</td>
						<td class="px-4 py-3 text-xs text-slate-600">
							{formatDateTime(n.sentAt ?? n.createdAt)}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="mt-4">
		<Pagination
			basePath={resolve('admin/notificaciones')}
			page={data.notifications.page}
			pageSize={data.notifications.pageSize}
			total={data.notifications.total}
		/>
	</div>
{/if}
