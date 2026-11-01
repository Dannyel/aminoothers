<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import LotActions from '#lib/components/admin/LotActions.svelte';
	import LotStatusBadges from '#lib/components/admin/LotStatusBadges.svelte';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import SelectField from '#lib/components/ui/SelectField.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';
	import { can, formatDate } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const product = $derived(data.product);
	const canAdjust = $derived(can(data.staff, 'inventory.adjust'));
	const canQuarantine = $derived(can(data.staff, 'inventory.quarantine'));
	const isMedicine = $derived(product.activeIngredients.length > 0);
	const values = $derived(form && 'values' in form ? form.values : undefined);
</script>

<PageHeading title={product.name} description="{product.sku} · lotes y existencias">
	{#snippet actions()}
		<a
			href={resolve(`admin/movimientos?productId=${product.id}`)}
			class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
			>Ver movimientos</a
		>
		<a
			href={resolve('admin/inventario')}
			class="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-200">← Volver</a
		>
	{/snippet}
</PageHeading>

<div class="flex flex-col gap-4">
	<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
	<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />

	<div class="flex items-center justify-between">
		<h2 class="font-medium text-slate-900">Lotes (orden de salida FEFO)</h2>
		<a
			href={data.withStock
				? resolve(`admin/inventario/${product.id}?todos`)
				: resolve(`admin/inventario/${product.id}`)}
			class="text-sm text-teal-700 hover:underline"
			>{data.withStock ? 'Ver también lotes agotados' : 'Ver solo lotes con existencia'}</a
		>
	</div>

	{#if data.lots.items.length === 0}
		<EmptyState title="No hay lotes con existencia">
			Registre la existencia inicial o reciba una orden de compra.
		</EmptyState>
	{:else}
		<ul class="flex flex-col gap-3">
			{#each data.lots.items as lot (lot.id)}
				<li class="rounded-lg border border-slate-200 bg-white p-4">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div>
							<p class="font-medium text-slate-900">
								Lote {lot.lotNumber}
								<LotStatusBadges {lot} />
							</p>
							<p class="text-sm text-slate-600">
								Vence: {formatDate(lot.expirationDate)} · Costo promedio: Q{lot.avgUnitCost}
								{#if lot.statusReason}· {lot.statusReason}{/if}
							</p>
						</div>
						<dl class="grid grid-cols-3 gap-4 text-center text-sm">
							<div>
								<dt class="text-slate-500">Física</dt>
								<dd class="font-semibold">{lot.qtyOnHand}</dd>
							</div>
							<div>
								<dt class="text-slate-500">Reservada</dt>
								<dd class="font-semibold">{lot.qtyReserved}</dd>
							</div>
							<div>
								<dt class="text-slate-500">Disponible</dt>
								<dd class="font-semibold text-teal-800">{lot.qtyAvailable}</dd>
							</div>
						</dl>
					</div>
					{#if canAdjust || canQuarantine}
						<div class="mt-3 border-t border-slate-100 pt-3">
							<LotActions {lot} {canAdjust} {canQuarantine} />
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	{#if canAdjust}
		<details class="rounded-lg border border-slate-200 bg-white p-4" open={Boolean(values)}>
			<summary class="cursor-pointer text-sm font-medium text-slate-800">
				Registrar existencia inicial o ingreso fuera de compra
			</summary>
			<form
				method="post"
				action="?/createLot"
				class="mt-4 grid gap-4 sm:grid-cols-3"
				use:enhance={() =>
					async ({ update }) =>
						update({ reset: false })}
			>
				<TextField
					label="Número de lote"
					name="lotNumber"
					required
					maxlength={50}
					value={values?.lotNumber ?? ''}
				/>
				<TextField
					label="Vencimiento"
					name="expirationDate"
					type="date"
					required={isMedicine}
					value={values?.expirationDate ?? ''}
					hint={isMedicine ? 'Obligatorio para medicamentos.' : 'Déjelo vacío si no vence.'}
				/>
				<TextField
					label="Fabricación"
					name="manufacturingDate"
					type="date"
					value={values?.manufacturingDate ?? ''}
				/>
				<TextField
					label="Cantidad"
					name="quantity"
					type="number"
					min={1}
					required
					value={values ? String(values.quantity) : ''}
				/>
				<TextField
					label="Costo unitario (Q, sin IVA)"
					name="unitCost"
					inputmode="decimal"
					required
					value={values?.unitCost ?? ''}
				/>
				<SelectField
					label="Estado inicial"
					name="status"
					options={[
						{ value: 'AVAILABLE', label: 'Disponible' },
						{ value: 'QUARANTINE', label: 'Cuarentena' }
					]}
					value={values?.status ?? 'AVAILABLE'}
				/>
				<div class="sm:col-span-3">
					<TextField
						label="Observaciones"
						name="notes"
						maxlength={500}
						value={values?.notes ?? ''}
					/>
				</div>
				<div><Button type="submit">Registrar lote</Button></div>
			</form>
		</details>
	{/if}
</div>
