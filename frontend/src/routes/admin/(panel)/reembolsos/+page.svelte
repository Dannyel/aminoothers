<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import type { RefundStatus } from '#lib/api/types.ts';
	import {
		can,
		formatDateTime,
		formatMoney,
		formatOrderNumber,
		REFUND_METHOD_LABELS,
		REFUND_STATUS_LABELS
	} from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const canManage = $derived(can(data.staff, 'refunds.manage'));
	const statuses: RefundStatus[] = ['PENDING', 'COMPLETED', 'CANCELLED'];
</script>

<PageHeading title="Reembolsos" description="Reembolsos por cancelaciones y devoluciones." />

<div class="mb-4 flex flex-col gap-2">
	<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
	<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />
	<form method="get" class="flex items-end gap-2">
		<label class="flex flex-col gap-1 text-sm">
			<span class="font-medium text-slate-700">Estado</span>
			<select
				name="status"
				value={data.status}
				onchange={(e) => e.currentTarget.form?.requestSubmit()}
				class="rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600"
			>
				{#each statuses as s (s)}<option value={s}>{REFUND_STATUS_LABELS[s]}</option>{/each}
			</select>
		</label>
		<noscript
			><button class="rounded-md border border-slate-300 px-3 py-2 text-sm">Filtrar</button
			></noscript
		>
	</form>
</div>

{#if data.refunds.items.length === 0}
	<EmptyState title="No hay reembolsos en este estado" />
{:else}
	<ul class="flex flex-col gap-3">
		{#each data.refunds.items as r (r.id)}
			<li class="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<span>
						<a
							href={resolve(`admin/pedidos/${r.orderId}`)}
							class="font-medium text-teal-800 hover:underline"
							>{formatOrderNumber('PED', r.orderNumber)}</a
						>
						{#if r.returnNumber}· DEV-{r.returnNumber}{/if}
						· {REFUND_METHOD_LABELS[r.method]} · {r.reason}
					</span>
					<span class="font-semibold">{formatMoney(r.amount)}</span>
				</div>
				<p class="text-xs text-slate-500">
					Registrado {formatDateTime(r.createdAt)}{r.processedAt
						? ` · procesado ${formatDateTime(r.processedAt)} por ${r.processedBy?.name ?? '—'}`
						: ''}{r.reference ? ` · ref. ${r.reference}` : ''}
				</p>
				{#if r.status === 'PENDING' && canManage}
					<div class="flex flex-wrap items-end gap-2">
						<form method="post" action="?/completeRefund" class="flex items-end gap-2" use:enhance>
							<input type="hidden" name="refundId" value={r.id} />
							<input
								name="reference"
								required
								maxlength={100}
								placeholder="Referencia de la transferencia o recibo"
								class="rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600"
							/>
							<Button type="submit">Completar</Button>
						</form>
						<form method="post" action="?/cancelRefund" use:enhance>
							<input type="hidden" name="refundId" value={r.id} />
							<Button type="submit" variant="ghost">Anular</Button>
						</form>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
	<div class="mt-4">
		<Pagination
			basePath={resolve('admin/reembolsos')}
			page={data.refunds.page}
			pageSize={data.refunds.pageSize}
			total={data.refunds.total}
		/>
	</div>
{/if}
