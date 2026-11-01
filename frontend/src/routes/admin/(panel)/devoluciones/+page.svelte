<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import type { ReturnStatus } from '#lib/api/types.ts';
	import {
		formatDateTime,
		formatMoney,
		formatOrderNumber,
		RETURN_STATUS_LABELS,
		RETURN_STATUS_TONES
	} from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<PageHeading
	title="Devoluciones"
	description="Las unidades devueltas solo vuelven al inventario tras la inspección del regente."
/>

<form method="get" class="mb-4 flex items-end gap-2">
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Estado</span>
		<select
			name="status"
			value={data.status}
			onchange={(e) => e.currentTarget.form?.requestSubmit()}
			class="rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600"
		>
			<option value="">Todos</option>
			{#each data.statuses as s (s)}<option value={s}
					>{RETURN_STATUS_LABELS[s as ReturnStatus]}</option
				>{/each}
		</select>
	</label>
	<noscript
		><button class="rounded-md border border-slate-300 px-3 py-2 text-sm">Filtrar</button></noscript
	>
</form>

{#if data.returns.items.length === 0}
	<EmptyState title="No hay devoluciones" />
{:else}
	<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead
				class="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
			>
				<tr>
					<th class="px-4 py-3">Devolución</th>
					<th class="px-4 py-3">Pedido</th>
					<th class="px-4 py-3">Motivo</th>
					<th class="px-4 py-3">Estado</th>
					<th class="px-4 py-3 text-right">Importe</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.returns.items as r (r.id)}
					<tr>
						<td class="px-4 py-3">
							<a
								href={resolve(`admin/devoluciones/${r.id}`)}
								class="font-medium text-teal-800 hover:underline">DEV-{r.number}</a
							>
							<p class="text-xs text-slate-500">{formatDateTime(r.createdAt)}</p>
						</td>
						<td class="px-4 py-3">
							{formatOrderNumber('PED', r.orderNumber)}
							<p class="text-xs text-slate-500">{r.customerName}</p>
						</td>
						<td class="px-4 py-3">{r.reason}</td>
						<td class="px-4 py-3"
							><Badge tone={RETURN_STATUS_TONES[r.status]}>{RETURN_STATUS_LABELS[r.status]}</Badge
							></td
						>
						<td class="px-4 py-3 text-right">{formatMoney(r.amount)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="mt-4">
		<Pagination
			basePath={resolve('admin/devoluciones')}
			page={data.returns.page}
			pageSize={data.returns.pageSize}
			total={data.returns.total}
		/>
	</div>
{/if}
