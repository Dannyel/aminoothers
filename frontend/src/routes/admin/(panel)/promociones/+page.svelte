<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import type { PromotionState } from '#lib/api/types.ts';
	import {
		can,
		formatDateTime,
		PROMOTION_STATE_LABELS,
		PROMOTION_STATE_TONES,
		promotionValue
	} from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const field =
		'rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600';
</script>

<PageHeading
	title="Promociones"
	description="Descuentos por porcentaje o monto fijo; el precio normal no cambia."
>
	{#snippet actions()}
		{#if can(data.staff, 'promotions.manage')}
			<a
				href={resolve('admin/promociones/nueva')}
				class="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
				>Nueva promoción</a
			>
		{/if}
	{/snippet}
</PageHeading>

<form method="get" class="mb-4 flex flex-wrap items-end gap-3" role="search">
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Buscar</span>
		<input type="search" name="search" value={data.search} maxlength={100} class={field} />
	</label>
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Estado</span>
		<select name="state" value={data.state} class={field}>
			<option value="">Todas</option>
			{#each data.states as s (s)}<option value={s}
					>{PROMOTION_STATE_LABELS[s as PromotionState]}</option
				>{/each}
		</select>
	</label>
	<button
		class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
		>Filtrar</button
	>
</form>

{#if data.promotions.items.length === 0}
	<EmptyState title="No hay promociones" />
{:else}
	<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead
				class="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
			>
				<tr>
					<th class="px-4 py-3">Promoción</th>
					<th class="px-4 py-3">Descuento</th>
					<th class="px-4 py-3">Vigencia</th>
					<th class="px-4 py-3 text-right">Productos</th>
					<th class="px-4 py-3">Estado</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.promotions.items as p (p.id)}
					<tr>
						<td class="px-4 py-3">
							<a
								href={resolve(`admin/promociones/${p.id}`)}
								class="font-medium text-teal-800 hover:underline">{p.name}</a
							>
						</td>
						<td class="px-4 py-3">{promotionValue(p.type, p.value)}</td>
						<td class="px-4 py-3 whitespace-nowrap"
							>{formatDateTime(p.startsAt)} – {formatDateTime(p.endsAt)}</td
						>
						<td class="px-4 py-3 text-right">{p.products.length}</td>
						<td class="px-4 py-3"
							><Badge tone={PROMOTION_STATE_TONES[p.state]}>{PROMOTION_STATE_LABELS[p.state]}</Badge
							></td
						>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="mt-4">
		<Pagination
			basePath={resolve('admin/promociones')}
			page={data.promotions.page}
			pageSize={data.promotions.pageSize}
			total={data.promotions.total}
		/>
	</div>
{/if}
