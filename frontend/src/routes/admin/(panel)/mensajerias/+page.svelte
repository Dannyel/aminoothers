<script lang="ts">
	import { resolve } from '$app/paths';
	import CourierForm from '#lib/components/admin/CourierForm.svelte';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<PageHeading
	title="Mensajerías"
	description="Empresas que entregan los pedidos. El seguimiento se registra manualmente."
/>

<div class="flex flex-col gap-6">
	{#if data.rows.length === 0}
		<EmptyState title="Aún no hay mensajerías">
			Registre al menos una mensajería para poder despachar pedidos.
		</EmptyState>
	{:else}
		<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
			<table class="min-w-full divide-y divide-slate-200 text-sm">
				<thead
					class="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
				>
					<tr>
						<th class="px-4 py-3">Nombre</th>
						<th class="px-4 py-3">Teléfono</th>
						<th class="px-4 py-3">Rastreo en línea</th>
						<th class="px-4 py-3">Estado</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each data.rows as c (c.id)}
						<tr>
							<td class="px-4 py-3">
								<a href={resolve(`admin/mensajerias/${c.id}`)} class="text-teal-800 hover:underline"
									>{c.name}</a
								>
							</td>
							<td class="px-4 py-3">{c.phone ?? '—'}</td>
							<td class="px-4 py-3">{c.trackingUrlTemplate ? 'Sí' : 'No'}</td>
							<td class="px-4 py-3">
								<Badge tone={c.isActive ? 'success' : 'neutral'}
									>{c.isActive ? 'Activa' : 'Inactiva'}</Badge
								>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
	<section class="flex flex-col gap-3">
		<h2 class="font-semibold text-slate-900">Nueva mensajería</h2>
		<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
		<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />
		<CourierForm action="?/create" submitLabel="Agregar" />
	</section>
</div>
