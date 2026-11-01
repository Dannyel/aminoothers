<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { formatDate, formatMoney, PAYMENT_METHOD_LABELS } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const p = $derived(data.params);
	const base = resolve('admin/reportes');
	const tabs = [
		{ view: 'ventas', label: 'Ventas por día' },
		{ view: 'productos', label: 'Productos más vendidos' },
		{ view: 'categorias', label: 'Ventas por categoría' },
		{ view: 'inventario', label: 'Inventario valorizado' }
	] as const;
	const range = $derived(`from=${p.from}&to=${p.to}`);
	const field =
		'rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600';
	const th = 'px-4 py-3';
	const td = 'px-4 py-2';
	const num = 'px-4 py-2 text-right tabular-nums';
</script>

<!-- Las pestañas y la descarga agregan parámetros a rutas resueltas con resolve(). -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

<PageHeading
	title="Reportes"
	description="Ventas de pedidos confirmados (sin cancelados ni pendientes de pago), por la fecha en que se hicieron, en hora de Guatemala. Montos con IVA incluido."
/>

<nav class="mb-4 flex flex-wrap gap-2" aria-label="Reportes">
	{#each tabs as tab (tab.view)}
		<a
			href="{base}?vista={tab.view}&{range}"
			aria-current={p.view === tab.view ? 'page' : undefined}
			class="rounded-full border px-3 py-1.5 text-sm {p.view === tab.view
				? 'border-teal-700 bg-teal-700 text-white'
				: 'border-slate-300 bg-white text-slate-700 hover:border-teal-600'}">{tab.label}</a
		>
	{/each}
</nav>

<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
	{#if p.view !== 'inventario'}
		<form method="get" class="flex flex-wrap items-end gap-3">
			<input type="hidden" name="vista" value={p.view} />
			<label class="flex flex-col gap-1 text-sm">
				<span class="font-medium text-slate-700">Desde</span>
				<input type="date" name="from" value={p.from} class={field} />
			</label>
			<label class="flex flex-col gap-1 text-sm">
				<span class="font-medium text-slate-700">Hasta</span>
				<input type="date" name="to" value={p.to} class={field} />
			</label>
			<button
				class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
				>Consultar</button
			>
		</form>
	{:else}
		<p class="text-sm text-slate-600">
			Existencias al {formatDate(data.data.view === 'inventario' ? data.data.report.date : p.to)},
			al costo promedio de cada lote.
		</p>
	{/if}
	<a
		href="{resolve('admin/reportes/csv')}?vista={p.view}&{range}"
		class="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
		>Descargar CSV</a
	>
</div>

{#if data.data.view === 'ventas'}
	{@const r = data.data.report}
	<div class="mb-6 grid gap-4 sm:grid-cols-4">
		{#each [{ label: 'Total vendido', value: formatMoney(r.totals.total) }, { label: 'Pedidos', value: String(r.totals.orders) }, { label: 'Ticket promedio', value: formatMoney(r.totals.averageTicket) }, { label: 'IVA incluido', value: formatMoney(r.totals.tax) }] as item (item.label)}
			<div class="rounded-lg border border-slate-200 bg-white p-5">
				<p class="text-sm text-slate-500">{item.label}</p>
				<p class="text-2xl font-semibold text-slate-900">{item.value}</p>
			</div>
		{/each}
	</div>
	{#if r.byPaymentMethod.length > 0}
		<p class="mb-4 text-sm text-slate-600">
			{#each r.byPaymentMethod as m, i (m.method)}{i > 0 ? ' · ' : ''}{PAYMENT_METHOD_LABELS[
					m.method
				]}: {formatMoney(m.total)} ({m.orders} pedido(s)){/each}
		</p>
	{/if}
	<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead
				class="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
			>
				<tr>
					<th class={th}>Fecha</th>
					<th class="{th} text-right">Pedidos</th>
					<th class="{th} text-right">Unidades</th>
					<th class="{th} text-right">Subtotal</th>
					<th class="{th} text-right">Descuentos</th>
					<th class="{th} text-right">Envío</th>
					<th class="{th} text-right">Total</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each r.days as d (d.date)}
					<tr class={d.orders === 0 ? 'text-slate-400' : ''}>
						<td class={td}>{formatDate(d.date)}</td>
						<td class={num}>{d.orders}</td>
						<td class={num}>{d.units}</td>
						<td class={num}>{formatMoney(d.subtotal)}</td>
						<td class={num}>{formatMoney(d.discount)}</td>
						<td class={num}>{formatMoney(d.shipping)}</td>
						<td class="{num} font-medium">{formatMoney(d.total)}</td>
					</tr>
				{/each}
			</tbody>
			<tfoot class="bg-slate-50 font-semibold">
				<tr>
					<td class={td}>Total</td>
					<td class={num}>{r.totals.orders}</td>
					<td class={num}>{r.totals.units}</td>
					<td class={num}>{formatMoney(r.totals.subtotal)}</td>
					<td class={num}>{formatMoney(r.totals.discount)}</td>
					<td class={num}>{formatMoney(r.totals.shipping)}</td>
					<td class={num}>{formatMoney(r.totals.total)}</td>
				</tr>
			</tfoot>
		</table>
	</div>
	<p class="mt-2 text-xs text-slate-500">
		Montos brutos: las devoluciones y reembolsos se ven en <a
			href={resolve('admin/ingresos')}
			class="text-teal-800 hover:underline">Ingresos</a
		>.
	</p>
{:else if data.data.view === 'productos'}
	{@const r = data.data.report}
	{#if r.rows.length === 0}
		<EmptyState title="No hay ventas en el período" />
	{:else}
		<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
			<table class="min-w-full divide-y divide-slate-200 text-sm">
				<thead
					class="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
				>
					<tr>
						<th class={th}>#</th>
						<th class={th}>Producto</th>
						<th class="{th} text-right">Unidades</th>
						<th class="{th} text-right">Descuentos</th>
						<th class="{th} text-right">Total vendido</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each r.rows as row, i (row.productId)}
						<tr>
							<td class="{td} text-slate-500">{i + 1}</td>
							<td class={td}>
								<a
									href={resolve(`admin/productos/${row.productId}`)}
									class="font-medium text-teal-800 hover:underline">{row.name}</a
								>
								<p class="text-xs text-slate-500">{row.sku}</p>
							</td>
							<td class={num}>{row.units}</td>
							<td class={num}>{formatMoney(row.discount)}</td>
							<td class="{num} font-medium">{formatMoney(row.revenue)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
{:else if data.data.view === 'categorias'}
	{@const r = data.data.report}
	{#if r.rows.length === 0}
		<EmptyState title="No hay ventas en el período" />
	{:else}
		<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
			<table class="min-w-full divide-y divide-slate-200 text-sm">
				<thead
					class="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
				>
					<tr>
						<th class={th}>Categoría</th>
						<th class="{th} text-right">Unidades</th>
						<th class="{th} text-right">Total vendido</th>
						<th class="{th} w-1/3">% del total</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each r.rows as row (row.categoryId)}
						<tr>
							<td class="{td} font-medium">{row.name}</td>
							<td class={num}>{row.units}</td>
							<td class={num}>{formatMoney(row.revenue)}</td>
							<td class={td}>
								<div class="flex items-center gap-2">
									<div class="h-2 flex-1 rounded-full bg-slate-100" aria-hidden="true">
										<div class="h-2 rounded-full bg-teal-600" style:width="{row.share}%"></div>
									</div>
									<span class="w-12 text-right tabular-nums">{row.share} %</span>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
				<tfoot class="bg-slate-50 font-semibold">
					<tr>
						<td class={td}>Total</td>
						<td></td>
						<td class={num}>{formatMoney(r.total)}</td>
						<td></td>
					</tr>
				</tfoot>
			</table>
		</div>
	{/if}
{:else}
	{@const r = data.data.report}
	<div class="mb-6 grid gap-4 sm:grid-cols-3">
		<div class="rounded-lg border border-slate-200 bg-white p-5">
			<p class="text-sm text-slate-500">Valor al costo</p>
			<p class="text-2xl font-semibold">{formatMoney(r.totalValue)}</p>
		</div>
		<div class="rounded-lg border border-slate-200 bg-white p-5">
			<p class="text-sm text-slate-500">Unidades en existencia</p>
			<p class="text-2xl font-semibold">{r.totalUnits}</p>
		</div>
		<div class="rounded-lg border border-slate-200 bg-white p-5">
			<p class="text-sm text-slate-500">No vendible (vencido, cuarentena, retirado o bloqueado)</p>
			<p class="text-2xl font-semibold {Number(r.unsellableValue) > 0 ? 'text-amber-700' : ''}">
				{formatMoney(r.unsellableValue)}
			</p>
		</div>
	</div>
	{#if r.rows.length === 0}
		<EmptyState title="No hay existencias" />
	{:else}
		<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
			<table class="min-w-full divide-y divide-slate-200 text-sm">
				<thead
					class="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
				>
					<tr>
						<th class={th}>Producto</th>
						<th class="{th} text-right">Unidades</th>
						<th class="{th} text-right">No vendibles</th>
						<th class="{th} text-right">Valor al costo</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each r.rows as row (row.productId)}
						<tr>
							<td class={td}>
								<span class="font-medium">{row.name}</span>
								<p class="text-xs text-slate-500">{row.sku}</p>
							</td>
							<td class={num}>{row.units}</td>
							<td class="{num} {row.unsellableUnits > 0 ? 'text-amber-700' : 'text-slate-400'}"
								>{row.unsellableUnits}</td
							>
							<td class="{num} font-medium">{formatMoney(row.value)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
{/if}
