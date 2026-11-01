<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import {
		can,
		DISPOSITION_LABELS,
		formatDateTime,
		formatMoney,
		formatOrderNumber,
		REFUND_STATUS_LABELS,
		RETURN_STATUS_LABELS,
		RETURN_STATUS_TONES
	} from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const ret = $derived(data.ret);
	const canManage = $derived(can(data.staff, 'returns.manage'));
	const canInspect = $derived(can(data.staff, 'returns.inspect'));
	const field =
		'rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600';
</script>

<PageHeading
	title="Devolución DEV-{ret.number}"
	description="Pedido {formatOrderNumber('PED', ret.orderNumber)} · {ret.customerName}"
>
	{#snippet actions()}
		<a
			href={resolve(`admin/pedidos/${ret.orderId}`)}
			class="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-200">Ver pedido</a
		>
		<a
			href={resolve('admin/devoluciones')}
			class="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-200">← Devoluciones</a
		>
	{/snippet}
</PageHeading>

<div class="flex max-w-4xl flex-col gap-4 text-sm">
	<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
	<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />

	<section class="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-5">
		<div class="flex flex-wrap items-center gap-2">
			<Badge tone={RETURN_STATUS_TONES[ret.status]}>{RETURN_STATUS_LABELS[ret.status]}</Badge>
			<span>{ret.reason} · {formatMoney(ret.amount)}</span>
		</div>
		{#if ret.notes}<p class="text-slate-600">{ret.notes}</p>{/if}
		{#if ret.rejectedReason}<p class="text-red-700">Rechazada: {ret.rejectedReason}</p>{/if}
		<p class="text-xs text-slate-500">
			Registrada {formatDateTime(ret.createdAt)}{ret.createdBy
				? ` por ${ret.createdBy.name}`
				: ''}{ret.receivedAt ? ` · recibida ${formatDateTime(ret.receivedAt)}` : ''}{ret.closedAt
				? ` · cerrada ${formatDateTime(ret.closedAt)}`
				: ''}
		</p>
		{#if canManage && ret.status === 'REQUESTED'}
			<form method="post" action="?/approve" use:enhance>
				<Button type="submit">Aprobar</Button>
			</form>
		{/if}
		{#if canManage && ret.status === 'APPROVED'}
			<form method="post" action="?/receive" use:enhance>
				<Button type="submit">Registrar recepción de las unidades</Button>
			</form>
		{/if}
		{#if canManage && (ret.status === 'REQUESTED' || ret.status === 'APPROVED')}
			<form method="post" action="?/reject" class="flex flex-wrap items-end gap-2" use:enhance>
				<input
					name="reason"
					required
					maxlength={500}
					placeholder="Motivo del rechazo"
					class="{field} flex-1"
				/>
				<Button type="submit" variant="danger">Rechazar</Button>
			</form>
		{/if}
	</section>

	<section class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5">
		<h2 class="font-semibold text-slate-900">Unidades</h2>
		{#each ret.items as item (item.id)}
			<div class="flex flex-col gap-2 rounded-md border border-slate-200 p-3">
				<p>
					<span class="font-medium">{item.quantity} × {item.productName}</span>
					<span class="text-slate-500"
						>· {item.sku} · lote {item.lotNumber} · {formatMoney(item.amount)}</span
					>
				</p>
				<p>
					{DISPOSITION_LABELS[item.disposition]}{item.inspectedBy
						? ` · ${item.inspectedBy.name}, ${formatDateTime(item.inspectedAt)}`
						: ''}{item.conditionNotes ? ` · ${item.conditionNotes}` : ''}
				</p>
				{#if canInspect && ret.status === 'RECEIVED' && item.disposition === 'PENDING_INSPECTION'}
					<form method="post" action="?/inspect" class="flex flex-wrap items-end gap-2" use:enhance>
						<input type="hidden" name="itemId" value={item.id} />
						<select name="disposition" class={field}>
							<option value="RESTOCK">Reincorporar a su lote</option>
							<option value="DESTROY">Destruir</option>
							<option value="RETURN_TO_SUPPLIER">Devolver al proveedor</option>
						</select>
						<input
							name="conditionNotes"
							maxlength={500}
							placeholder="Estado del producto"
							class="{field} flex-1"
						/>
						<Button type="submit">Registrar inspección</Button>
					</form>
				{/if}
			</div>
		{/each}
		<p class="text-xs text-slate-500">
			Solo se reincorpora si el lote sigue disponible y vigente; en otro caso, destruya o devuelva
			al proveedor.
		</p>
	</section>

	{#if ret.refunds.length > 0}
		<section class="rounded-lg border border-slate-200 bg-white p-5">
			<h2 class="mb-2 font-semibold text-slate-900">Reembolsos</h2>
			<ul>
				{#each ret.refunds as r (r.id)}
					<li>
						{formatMoney(r.amount)} · {REFUND_STATUS_LABELS[r.status]}{r.reference
							? ` · ref. ${r.reference}`
							: ''}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
