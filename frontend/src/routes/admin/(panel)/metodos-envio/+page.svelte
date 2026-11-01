<script lang="ts">
	import { resolve } from '$app/paths';
	import ShippingMethodForm from '#lib/components/admin/ShippingMethodForm.svelte';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { deliveryEstimate, formatMoney } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<PageHeading
	title="Métodos de envío"
	description="Tarifa fija por método (IVA incluido). Las mensajerías y guías se gestionan con los pedidos."
/>

<div class="flex flex-col gap-6">
	{#if data.methods.length === 0}
		<EmptyState title="Aún no hay métodos de envío">
			Sin métodos de envío activos los clientes no pueden finalizar compras.
		</EmptyState>
	{:else}
		<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
			<table class="min-w-full divide-y divide-slate-200 text-sm">
				<thead
					class="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
				>
					<tr>
						<th class="px-4 py-3">Método</th>
						<th class="px-4 py-3 text-right">Costo</th>
						<th class="px-4 py-3">Entrega</th>
						<th class="px-4 py-3">Contra entrega</th>
						<th class="px-4 py-3">Estado</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each data.methods as m (m.id)}
						<tr>
							<td class="px-4 py-3">
								<a
									href={resolve(`admin/metodos-envio/${m.id}`)}
									class="text-teal-800 hover:underline">{m.name}</a
								>
								{#if m.coverageNote}<p class="text-slate-500">{m.coverageNote}</p>{/if}
							</td>
							<td class="px-4 py-3 text-right">{formatMoney(m.cost)}</td>
							<td class="px-4 py-3"
								>{deliveryEstimate(m.estimatedDaysMin, m.estimatedDaysMax) ?? '—'}</td
							>
							<td class="px-4 py-3">{m.allowsCashOnDelivery ? 'Sí' : 'No'}</td>
							<td class="px-4 py-3">
								<Badge tone={m.isActive ? 'success' : 'neutral'}
									>{m.isActive ? 'Activo' : 'Inactivo'}</Badge
								>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<section class="flex flex-col gap-3">
		<h2 class="font-semibold text-slate-900">Nuevo método de envío</h2>
		<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
		<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />
		<ShippingMethodForm couriers={data.couriers} action="?/create" submitLabel="Agregar" />
	</section>
</div>
