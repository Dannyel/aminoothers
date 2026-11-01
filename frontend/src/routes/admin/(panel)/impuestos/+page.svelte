<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { can } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const canManage = $derived(can(data.staff, 'billing.manage'));
	const percent = (rate: string) => String(Number((Number(rate) * 100).toFixed(2)));
	const field =
		'rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600';
	const keep =
		() =>
		async ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) =>
			update({ reset: false });
</script>

<PageHeading
	title="Impuestos"
	description="Los precios incluyen IVA (D1). Cada pedido guarda la tasa aplicada: un cambio solo afecta las ventas siguientes."
/>

<div class="flex max-w-4xl flex-col gap-4">
	<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
	<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />

	{#each data.rates as rate (rate.id)}
		<form
			method="post"
			action="?/update"
			class="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm sm:grid-cols-6 sm:items-end"
			use:enhance={keep}
		>
			<input type="hidden" name="id" value={rate.id} />
			<div class="sm:col-span-1">
				<p class="font-mono text-xs text-slate-500">{rate.code}</p>
				<div class="flex gap-1">
					{#if rate.isDefault}<Badge tone="info">Predeterminada</Badge>{/if}
					{#if !rate.isActive}<Badge>Inactiva</Badge>{/if}
				</div>
				<p class="text-xs text-slate-500">{rate.productCount} producto(s)</p>
			</div>
			<label class="flex flex-col gap-1 sm:col-span-2">
				<span class="font-medium text-slate-700">Nombre</span>
				<input
					name="name"
					required
					maxlength={100}
					value={rate.name}
					disabled={!canManage}
					class={field}
				/>
			</label>
			<label class="flex flex-col gap-1">
				<span class="font-medium text-slate-700">Tasa (%)</span>
				<input
					name="ratePercent"
					required
					pattern={'\\d{1,2}(\\.\\d{1,2})?'}
					value={percent(rate.rate)}
					disabled={!canManage}
					class={field}
				/>
			</label>
			<div class="flex flex-col gap-1">
				<label class="flex items-center gap-2"
					><input
						type="checkbox"
						name="isActive"
						checked={rate.isActive}
						disabled={!canManage}
						class="rounded border-slate-300 text-teal-700"
					/> Activa</label
				>
				<label class="flex items-center gap-2"
					><input
						type="checkbox"
						name="isDefault"
						checked={rate.isDefault}
						disabled={!canManage || rate.isDefault}
						class="rounded border-slate-300 text-teal-700"
					/> Predeterminada</label
				>
			</div>
			{#if canManage}<Button type="submit" variant="secondary">Guardar</Button>{/if}
		</form>
	{/each}

	{#if canManage}
		<form
			method="post"
			action="?/create"
			class="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm sm:grid-cols-5 sm:items-end"
			use:enhance
		>
			<h2 class="font-semibold text-slate-900 sm:col-span-5">Nueva tasa</h2>
			<label class="flex flex-col gap-1">
				<span class="font-medium text-slate-700">Código</span>
				<input name="code" required pattern={'[A-Za-z0-9_]{2,20}'} class={field} />
			</label>
			<label class="flex flex-col gap-1 sm:col-span-2">
				<span class="font-medium text-slate-700">Nombre</span>
				<input name="name" required maxlength={100} class={field} />
			</label>
			<label class="flex flex-col gap-1">
				<span class="font-medium text-slate-700">Tasa (%)</span>
				<input name="ratePercent" required pattern={'\\d{1,2}(\\.\\d{1,2})?'} class={field} />
			</label>
			<label class="flex items-center gap-2"
				><input type="checkbox" name="isDefault" class="rounded border-slate-300 text-teal-700" /> Predeterminada</label
			>
			<div class="sm:col-span-5"><Button type="submit">Agregar tasa</Button></div>
		</form>
	{/if}
</div>
