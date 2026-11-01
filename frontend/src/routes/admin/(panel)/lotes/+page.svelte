<script lang="ts">
	import { resolve } from '$app/paths';
	import LotActions from '#lib/components/admin/LotActions.svelte';
	import LotStatusBadges from '#lib/components/admin/LotStatusBadges.svelte';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import { can, formatDate, LOT_STATUS_LABELS } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const canAdjust = $derived(can(data.staff, 'inventory.adjust'));
	const canQuarantine = $derived(can(data.staff, 'inventory.quarantine'));
	const field =
		'rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600';
</script>

<PageHeading
	title="Lotes y vencimientos"
	description="Lotes con existencia, del más próximo a vencer al más lejano."
/>

<div class="flex flex-col gap-4">
	<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
	<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />

	<form method="get" class="grid gap-3 sm:grid-cols-4 sm:items-end" role="search">
		<label class="flex flex-col gap-1 text-sm sm:col-span-2">
			<span class="font-medium text-slate-700">Buscar (lote, producto o SKU)</span>
			<input
				type="search"
				name="search"
				value={data.filters.search}
				maxlength={100}
				class={field}
			/>
		</label>
		<label class="flex flex-col gap-1 text-sm">
			<span class="font-medium text-slate-700">Vencimiento</span>
			<select name="expiry" value={data.filters.expiry} class={field}>
				<option value="all">Todos</option>
				<option value="near">Próximos a vencer</option>
				<option value="expired">Vencidos</option>
			</select>
		</label>
		<div class="flex items-end gap-2">
			<label class="flex flex-1 flex-col gap-1 text-sm">
				<span class="font-medium text-slate-700">Estado</span>
				<select name="status" value={data.filters.status} class={field}>
					<option value="">Todos</option>
					{#each Object.entries(LOT_STATUS_LABELS) as [value, label] (value)}<option {value}
							>{label}</option
						>{/each}
				</select>
			</label>
			<button
				class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
			>
				Filtrar
			</button>
		</div>
	</form>

	{#if data.lots.items.length === 0}
		<EmptyState title="No hay lotes que coincidan" />
	{:else}
		<ul class="flex flex-col gap-3">
			{#each data.lots.items as lot (lot.id)}
				<li class="rounded-lg border border-slate-200 bg-white p-4">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div>
							<a
								href={resolve(`admin/inventario/${lot.product.id}`)}
								class="font-medium text-teal-800 hover:underline">{lot.product.name}</a
							>
							<p class="text-sm text-slate-600">
								{lot.product.sku} · Lote {lot.lotNumber} · Vence {formatDate(lot.expirationDate)}
							</p>
							<div class="mt-1"><LotStatusBadges {lot} /></div>
						</div>
						<p class="text-sm text-slate-700">
							Física <strong>{lot.qtyOnHand}</strong> · Disponible
							<strong>{lot.qtyAvailable}</strong>
						</p>
					</div>
					{#if canAdjust || canQuarantine}
						<div class="mt-3 border-t border-slate-100 pt-3">
							<LotActions {lot} {canAdjust} {canQuarantine} />
						</div>
					{/if}
				</li>
			{/each}
		</ul>
		<Pagination
			basePath={resolve('admin/lotes')}
			page={data.lots.page}
			pageSize={data.lots.pageSize}
			total={data.lots.total}
		/>
	{/if}
</div>
