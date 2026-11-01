<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Courier, ShippingMethod } from '#lib/api/types.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';

	let {
		method,
		couriers,
		action,
		submitLabel
	}: {
		method?: Partial<ShippingMethod>;
		couriers: Courier[];
		action: string;
		submitLabel: string;
	} = $props();
</script>

<form
	method="post"
	{action}
	class="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 sm:grid-cols-2"
	use:enhance={() =>
		async ({ update }) =>
			update({ reset: !method?.id })}
>
	<TextField label="Nombre" name="name" required maxlength={100} value={method?.name ?? ''} />
	<TextField
		label="Costo para el cliente (Q, IVA incluido)"
		name="cost"
		required
		inputmode="decimal"
		pattern={'\\d{1,10}(\\.\\d{1,2})?'}
		hint="0 para envío gratis."
		value={method?.cost ?? ''}
	/>
	<div class="sm:col-span-2">
		<TextField
			label="Descripción"
			name="description"
			maxlength={300}
			value={method?.description ?? ''}
		/>
	</div>
	<TextField
		label="Entrega mínima (días hábiles)"
		name="estimatedDaysMin"
		type="number"
		min={0}
		max={60}
		value={method?.estimatedDaysMin ?? ''}
	/>
	<TextField
		label="Entrega máxima (días hábiles)"
		name="estimatedDaysMax"
		type="number"
		min={0}
		max={60}
		value={method?.estimatedDaysMax ?? ''}
	/>
	<div class="sm:col-span-2">
		<TextField
			label="Cobertura"
			name="coverageNote"
			maxlength={300}
			hint="Por ejemplo: «Ciudad de Guatemala, Mixco y Villa Nueva»."
			value={method?.coverageNote ?? ''}
		/>
	</div>
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Mensajería habitual</span>
		<select
			name="courierId"
			value={method?.courierId ?? ''}
			class="rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600"
		>
			<option value="">Sin asignar</option>
			{#each couriers as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
		</select>
	</label>
	<TextField
		label="Orden"
		name="sortOrder"
		type="number"
		min={0}
		max={1000}
		value={method?.sortOrder ?? 0}
	/>
	<div class="flex flex-col justify-end gap-2 text-sm text-slate-700">
		<label class="flex items-center gap-2">
			<input
				type="checkbox"
				name="allowsCashOnDelivery"
				checked={method?.allowsCashOnDelivery ?? true}
				class="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
			/>
			Admite pago contra entrega
		</label>
		<label class="flex items-center gap-2">
			<input
				type="checkbox"
				name="isActive"
				checked={method?.isActive ?? true}
				class="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
			/>
			Disponible en la tienda
		</label>
	</div>
	<div class="sm:col-span-2">
		<Button type="submit">{submitLabel}</Button>
	</div>
</form>
