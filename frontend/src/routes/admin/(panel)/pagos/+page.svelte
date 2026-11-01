<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import type { PaymentStatus } from '#lib/api/types.ts';
	import {
		formatDate,
		formatDateTime,
		formatMoney,
		formatOrderNumber,
		PAYMENT_METHOD_LABELS,
		PAYMENT_STATUS_LABELS
	} from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<PageHeading
	title="Pagos"
	description="Las transferencias se verifican manualmente contra el estado de cuenta antes de confirmar el pedido."
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
			{#each data.statuses as s (s)}<option value={s}
					>{PAYMENT_STATUS_LABELS[s as PaymentStatus]}</option
				>{/each}
		</select>
	</label>
	<noscript
		><button class="rounded-md border border-slate-300 px-3 py-2 text-sm">Filtrar</button></noscript
	>
</form>

{#if data.payments.items.length === 0}
	<EmptyState title="No hay pagos en este estado" />
{:else}
	<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead
				class="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
			>
				<tr>
					<th class="px-4 py-3">Pedido</th>
					<th class="px-4 py-3">Cliente</th>
					<th class="px-4 py-3">Método</th>
					<th class="px-4 py-3">Datos</th>
					<th class="px-4 py-3 text-right">Monto</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.payments.items as p (p.id)}
					<tr>
						<td class="px-4 py-3">
							<a
								href={resolve(`admin/pedidos/${p.order.id}`)}
								class="font-medium text-teal-800 hover:underline"
								>{formatOrderNumber('PED', p.order.number)}</a
							>
						</td>
						<td class="px-4 py-3">{p.order.customerName}</td>
						<td class="px-4 py-3">{PAYMENT_METHOD_LABELS[p.method]}</td>
						<td class="px-4 py-3">
							{#if p.bankAccount}
								{p.bankAccount.bankName} · ref. {p.bankReference} · {formatDate(p.transferDate)}
								<p class="text-xs text-slate-500">Enviado {formatDateTime(p.submittedAt)}</p>
							{:else}—{/if}
						</td>
						<td class="px-4 py-3 text-right font-semibold">{formatMoney(p.amount)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="mt-4">
		<Pagination
			basePath={resolve('admin/pagos')}
			page={data.payments.page}
			pageSize={data.payments.pageSize}
			total={data.payments.total}
		/>
	</div>
{/if}
