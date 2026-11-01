<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { enhance } from '$app/forms';
	import type { ProductOption, Promotion } from '#lib/api/types.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';

	let {
		promotion,
		products,
		action,
		submitLabel
	}: {
		promotion?: Promotion;
		products: ProductOption[];
		action: string;
		submitLabel: string;
	} = $props();

	/** ISO → valor de datetime-local en la hora de Guatemala. */
	const local = (iso: string | undefined) =>
		iso
			? new Intl.DateTimeFormat('sv-SE', {
					timeZone: 'America/Guatemala',
					dateStyle: 'short',
					timeStyle: 'short'
				})
					.format(new Date(iso))
					.replace(' ', 'T')
			: '';

	let filter = $state('');
	// Selección editable a partir de los productos guardados al abrir el formulario.
	const selected = new SvelteSet(untrack(() => promotion?.products.map((p) => p.id) ?? []));
	const visible = $derived(
		products.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(filter.trim().toLowerCase()))
	);
	const toggle = (id: string, on: boolean) => {
		if (on) selected.add(id);
		else selected.delete(id);
	};
	const field =
		'rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600';
</script>

<form
	method="post"
	{action}
	class="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 sm:grid-cols-2"
	use:enhance={() =>
		async ({ update }) =>
			update({ reset: false })}
>
	<TextField label="Nombre" name="name" required maxlength={150} value={promotion?.name ?? ''} />
	<TextField
		label="Descripción"
		name="description"
		maxlength={500}
		value={promotion?.description ?? ''}
	/>
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Tipo</span>
		<select name="type" value={promotion?.type ?? 'PERCENTAGE'} class={field}>
			<option value="PERCENTAGE">Porcentaje</option>
			<option value="FIXED_AMOUNT">Monto fijo por unidad (Q)</option>
		</select>
	</label>
	<TextField
		label="Valor"
		name="value"
		required
		inputmode="decimal"
		pattern={'\\d{1,10}(\\.\\d{1,2})?'}
		hint="Porcentaje (1 a 100) o quetzales por unidad, menor que el precio."
		value={promotion?.value ?? ''}
	/>
	<TextField
		label="Inicio (hora de Guatemala)"
		name="startsAt"
		type="datetime-local"
		required
		value={local(promotion?.startsAt)}
	/>
	<TextField
		label="Fin (hora de Guatemala)"
		name="endsAt"
		type="datetime-local"
		required
		value={local(promotion?.endsAt)}
	/>
	<label class="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
		<input
			type="checkbox"
			name="isActive"
			checked={promotion?.isActive ?? true}
			class="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
		/>
		Activa
	</label>

	<fieldset class="flex flex-col gap-2 sm:col-span-2">
		<legend class="text-sm font-medium text-slate-700">
			Productos participantes ({selected.size})
		</legend>
		<input type="search" bind:value={filter} placeholder="Filtrar por nombre o SKU" class={field} />
		<div class="max-h-72 overflow-y-auto rounded-md border border-slate-200 p-2">
			{#each products as p (p.id)}
				<label class="flex items-center gap-2 py-1 text-sm {visible.includes(p) ? '' : 'hidden'}">
					<input
						type="checkbox"
						name="productIds"
						value={p.id}
						checked={selected.has(p.id)}
						onchange={(e) => toggle(p.id, e.currentTarget.checked)}
						class="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
					/>
					{p.name} <span class="text-slate-500">{p.sku}</span>
				</label>
			{/each}
		</div>
		<p class="text-xs text-slate-500">
			Si un producto tiene varias promociones vigentes se aplica solo la de mayor descuento.
		</p>
	</fieldset>
	<div class="sm:col-span-2"><Button type="submit">{submitLabel}</Button></div>
</form>
