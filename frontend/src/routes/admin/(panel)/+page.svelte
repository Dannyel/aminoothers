<script lang="ts">
	import { resolve } from '$app/paths';
	import DailySalesChart from '#lib/components/admin/DailySalesChart.svelte';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import { can, formatDate, formatMoney } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const d = $derived(data.dashboard);
	const nothing = $derived(!d.orders && !d.sales && !d.finance && !d.inventory && !d.notifications);
	const card = 'rounded-lg border border-slate-200 bg-white p-5';
	const tile =
		'block rounded-lg border border-slate-200 bg-white p-4 hover:border-teal-600 focus-visible:border-teal-600';
</script>

<!-- Los accesos agregan filtros (?status=…) a rutas resueltas con resolve(). -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

<PageHeading
	title="Bienvenido, {data.staff.firstName}"
	description="Resumen al {formatDate(d.today)}. Cada sección aparece según sus permisos."
/>

{#if nothing}
	<p class="text-sm text-slate-600">
		Su usuario aún no tiene permisos asignados. Solicítelos a un administrador.
	</p>
{/if}

{#if d.orders}
	{@const o = d.orders}
	<section class="mb-8" aria-labelledby="pendientes">
		<h2 id="pendientes" class="mb-3 text-base font-semibold text-slate-900">Pedidos por atender</h2>
		<div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
			{#each [{ label: 'Pedidos de hoy', value: o.placedToday, href: resolve('admin/pedidos') }, { label: 'Pagos por verificar', value: o.paymentInReview, href: resolve('admin/pagos'), warn: true }, { label: 'Contra entrega por confirmar', value: o.pendingConfirmation, href: `${resolve('admin/pedidos')}?status=PENDING_CONFIRMATION`, warn: true }, { label: 'Por preparar', value: o.toPrepare, href: `${resolve('admin/pedidos')}?status=CONFIRMED` }, { label: 'Por despachar', value: o.toShip, href: `${resolve('admin/pedidos')}?status=PREPARING` }, { label: 'Entrega fallida', value: o.deliveryFailed, href: `${resolve('admin/pedidos')}?status=DELIVERY_FAILED`, warn: true }] as item (item.label)}
				<a href={item.href} class={tile}>
					<p class="text-xs text-slate-500">{item.label}</p>
					<p
						class="mt-1 text-2xl font-semibold {item.warn && item.value > 0
							? 'text-amber-700'
							: 'text-slate-900'}"
					>
						{item.value}
					</p>
				</a>
			{/each}
		</div>
	</section>
{/if}

{#if d.sales}
	{@const s = d.sales}
	<section class="mb-8" aria-labelledby="ventas">
		<div class="mb-3 flex items-baseline justify-between">
			<h2 id="ventas" class="text-base font-semibold text-slate-900">Ventas</h2>
			<a href={resolve('admin/reportes')} class="text-sm text-teal-800 hover:underline"
				>Ver reportes</a
			>
		</div>
		<div class="grid gap-3 sm:grid-cols-3">
			{#each [{ label: 'Hoy', v: s.today }, { label: 'Últimos 7 días', v: s.last7Days }, { label: 'Mes en curso', v: s.monthToDate }] as item (item.label)}
				<div class={card}>
					<p class="text-sm text-slate-500">{item.label}</p>
					<p class="text-2xl font-semibold text-slate-900">{formatMoney(item.v.total)}</p>
					<p class="text-xs text-slate-500">{item.v.orders} pedido(s)</p>
				</div>
			{/each}
		</div>
		<div class="mt-4 grid gap-4 lg:grid-cols-3">
			<div class="{card} lg:col-span-2">
				<h3 class="mb-2 text-sm font-medium text-slate-700">Ventas por día · últimos 30 días</h3>
				<DailySalesChart days={s.daily} />
			</div>
			<div class={card}>
				<h3 class="mb-2 text-sm font-medium text-slate-700">Más vendidos · 30 días</h3>
				{#if s.topProducts.length === 0}
					<p class="text-sm text-slate-500">Aún no hay ventas en el período.</p>
				{:else}
					<ol class="divide-y divide-slate-100 text-sm">
						{#each s.topProducts as p (p.productId)}
							<li class="flex justify-between gap-3 py-2">
								<span class="text-slate-800">{p.name}</span>
								<span class="shrink-0 text-slate-600 tabular-nums">{p.units} u.</span>
							</li>
						{/each}
					</ol>
				{/if}
			</div>
		</div>
		<p class="mt-2 text-xs text-slate-500">
			Pedidos confirmados por la fecha en que se hicieron (con IVA y envío). No descuenta
			devoluciones ni reembolsos.
		</p>
	</section>
{/if}

<div class="grid gap-4 lg:grid-cols-3">
	{#if d.inventory}
		{@const i = d.inventory}
		<section class={card} aria-labelledby="inventario">
			<h2 id="inventario" class="mb-3 text-base font-semibold text-slate-900">Inventario</h2>
			<ul class="space-y-2 text-sm">
				{#each [{ label: 'Lotes vencidos con existencia', value: i.expiredLots, q: 'expired', bad: true }, { label: 'Lotes en cuarentena', value: i.quarantineLots, q: 'quarantine' }, { label: 'Lotes retirados del mercado', value: i.recalledLots, q: null }, { label: 'Lotes próximos a vencer', value: i.nearExpiryLots, q: 'near' }, { label: 'Productos con existencias bajas', value: i.lowStockProducts, q: 'low' }] as item (item.label)}
					<li class="flex justify-between gap-3">
						{#if item.q}
							<a
								href="{resolve('admin/inventario')}?alerta={item.q}"
								class="text-teal-800 hover:underline">{item.label}</a
							>
						{:else}
							<span class="text-slate-700">{item.label}</span>
						{/if}
						<span
							class="font-semibold tabular-nums {item.value > 0
								? item.bad
									? 'text-red-700'
									: 'text-amber-700'
								: 'text-slate-500'}">{item.value}</span
						>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if d.finance}
		{@const f = d.finance}
		<section class={card} aria-labelledby="finanzas">
			<h2 id="finanzas" class="mb-3 text-base font-semibold text-slate-900">Finanzas</h2>
			<ul class="space-y-2 text-sm">
				<li class="flex justify-between gap-3">
					<a href={resolve('admin/reembolsos')} class="text-teal-800 hover:underline"
						>Reembolsos pendientes ({f.pendingRefunds})</a
					>
					<span class="font-semibold tabular-nums">{formatMoney(f.pendingRefundsTotal)}</span>
				</li>
				<li class="flex justify-between gap-3">
					<a
						href="{resolve('admin/facturacion')}?felStatus=PENDING&status=ISSUED"
						class="text-teal-800 hover:underline">FEL pendientes de registrar</a
					>
					<span
						class="font-semibold tabular-nums {f.felPending > 0
							? 'text-amber-700'
							: 'text-slate-500'}">{f.felPending}</span
					>
				</li>
			</ul>
		</section>
	{/if}

	{#if d.notifications}
		{@const n = d.notifications}
		<section class={card} aria-labelledby="correos">
			<h2 id="correos" class="mb-3 text-base font-semibold text-slate-900">Correos</h2>
			<ul class="space-y-2 text-sm">
				<li class="flex justify-between gap-3">
					<span class="text-slate-700">En cola</span>
					<span class="font-semibold tabular-nums">{n.pending}</span>
				</li>
				<li class="flex justify-between gap-3">
					<a
						href="{resolve('admin/notificaciones')}?status=FAILED"
						class="text-teal-800 hover:underline">Fallidos</a
					>
					<span
						class="font-semibold tabular-nums {n.failed > 0 ? 'text-red-700' : 'text-slate-500'}"
						>{n.failed}</span
					>
				</li>
			</ul>
		</section>
	{/if}
</div>

{#if can(data.staff, 'audit.read')}
	<p class="mt-6 text-xs text-slate-500">
		Las operaciones del personal quedan en la <a
			href={resolve('admin/auditoria')}
			class="text-teal-800 hover:underline">auditoría</a
		>.
	</p>
{/if}
