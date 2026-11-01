<script lang="ts">
	import { resolve } from '$app/paths';
	import BankAccountForm from '#lib/components/admin/BankAccountForm.svelte';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<PageHeading
	title="Cuentas bancarias"
	description="Cuentas que ve el cliente para pagar por transferencia."
/>

<div class="flex flex-col gap-6">
	{#if data.rows.length === 0}
		<EmptyState title="Aún no hay cuentas bancarias">
			Sin cuentas activas los clientes no pueden pagar por transferencia.
		</EmptyState>
	{:else}
		<div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
			<table class="min-w-full divide-y divide-slate-200 text-sm">
				<thead
					class="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
				>
					<tr>
						<th class="px-4 py-3">Banco</th>
						<th class="px-4 py-3">Cuenta</th>
						<th class="px-4 py-3">Titular</th>
						<th class="px-4 py-3">Estado</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each data.rows as a (a.id)}
						<tr>
							<td class="px-4 py-3">
								<a
									href={resolve(`admin/cuentas-bancarias/${a.id}`)}
									class="text-teal-800 hover:underline">{a.bankName}</a
								>
							</td>
							<td class="px-4 py-3">{a.accountType} {a.accountNumber}</td>
							<td class="px-4 py-3">{a.accountHolder}</td>
							<td class="px-4 py-3">
								<Badge tone={a.isActive ? 'success' : 'neutral'}
									>{a.isActive ? 'Activa' : 'Inactiva'}</Badge
								>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
	<section class="flex flex-col gap-3">
		<h2 class="font-semibold text-slate-900">Nueva cuenta</h2>
		<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
		<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />
		<BankAccountForm action="?/create" submitLabel="Agregar" />
	</section>
</div>
