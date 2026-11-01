<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import {
		formatDateTime,
		formatMoney,
		formatOrderNumber,
		ORDER_STATUS_LABELS,
		ORDER_STATUS_TONES
	} from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Mis pedidos · {data.info.tradeName}</title>
</svelte:head>

<PageHeading title="Mis pedidos" />

{#if data.orders.items.length === 0}
	<EmptyState title="Aún no tiene pedidos">
		<a href={resolve('productos')} class="text-teal-800 hover:underline">Ver el catálogo</a>
	</EmptyState>
{:else}
	<ul class="flex flex-col gap-3">
		{#each data.orders.items as order (order.id)}
			<li>
				<a
					href={resolve(`cuenta/pedidos/${order.id}`)}
					class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 hover:border-teal-600"
				>
					<span>
						<span class="font-medium text-slate-900">{formatOrderNumber('PED', order.number)}</span>
						<span class="block text-sm text-slate-500"
							>{formatDateTime(order.placedAt)} · {order.itemCount} unidad(es)</span
						>
					</span>
					<span class="flex items-center gap-3">
						<Badge tone={ORDER_STATUS_TONES[order.status]}
							>{ORDER_STATUS_LABELS[order.status]}</Badge
						>
						<span class="font-semibold">{formatMoney(order.total)}</span>
					</span>
				</a>
			</li>
		{/each}
	</ul>
	<div class="mt-4">
		<Pagination
			basePath={resolve('cuenta/pedidos')}
			page={data.orders.page}
			pageSize={data.orders.pageSize}
			total={data.orders.total}
		/>
	</div>
{/if}
