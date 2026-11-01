<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { ProductOption, PurchaseOrderDetail, Supplier } from '#lib/api/types.ts';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import SelectField from '#lib/components/ui/SelectField.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';

	let {
		suppliers,
		products,
		order,
		messages,
		submitLabel
	}: {
		suppliers: Supplier[];
		products: ProductOption[];
		order?: PurchaseOrderDetail;
		messages?: string[];
		submitLabel: string;
	} = $props();

	type Row = { key: number; productId: string; quantity: string; unitCost: string };
	let nextKey = 0;
	// Valores iniciales editables (el formulario agrega y quita líneas).
	let rows = $state<Row[]>(
		untrack(() =>
			order?.items.length
				? order.items.map((i) => ({
						key: nextKey++,
						productId: i.product.id,
						quantity: String(i.quantityOrdered),
						unitCost: i.unitCost
					}))
				: [{ key: nextKey++, productId: '', quantity: '', unitCost: '' }]
		)
	);
	let submitting = $state(false);
	const field =
		'w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600';
</script>

<form
	method="post"
	class="flex flex-col gap-4"
	use:enhance={() => {
		submitting = true;
		return async ({ update }) => {
			await update({ reset: false });
			submitting = false;
		};
	}}
>
	<Alert variant="error" {messages} />
	<div class="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 sm:grid-cols-2">
		<SelectField
			label="Proveedor"
			name="supplierId"
			required
			placeholder="Seleccione…"
			options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
			value={order?.supplier.id ?? ''}
		/>
		<TextField
			label="Fecha esperada"
			name="expectedDate"
			type="date"
			value={order?.expectedDate ?? ''}
		/>
		<div class="sm:col-span-2">
			<TextField label="Notas" name="notes" maxlength={1000} value={order?.notes ?? ''} />
		</div>
	</div>

	<div class="rounded-lg border border-slate-200 bg-white p-6">
		<h2 class="mb-1 font-medium text-slate-900">Productos</h2>
		<p class="mb-4 text-sm text-slate-600">
			Costo unitario sin IVA; el impuesto se calcula con la tasa de cada producto.
		</p>
		<div class="flex flex-col gap-3">
			{#each rows as row, index (row.key)}
				<div class="grid gap-2 sm:grid-cols-[1fr_8rem_9rem_auto] sm:items-end">
					<label class="flex flex-col gap-1 text-sm">
						<span class="font-medium text-slate-700 {index > 0 ? 'sm:sr-only' : ''}">Producto</span>
						<select name="productId" required bind:value={row.productId} class={field}>
							<option value="">Seleccione…</option>
							{#each products as p (p.id)}<option value={p.id}>{p.name} · {p.sku}</option>{/each}
						</select>
					</label>
					<label class="flex flex-col gap-1 text-sm">
						<span class="font-medium text-slate-700 {index > 0 ? 'sm:sr-only' : ''}">Cantidad</span>
						<input
							name="quantity"
							type="number"
							min="1"
							required
							bind:value={row.quantity}
							class={field}
						/>
					</label>
					<label class="flex flex-col gap-1 text-sm">
						<span class="font-medium text-slate-700 {index > 0 ? 'sm:sr-only' : ''}"
							>Costo unit. (Q)</span
						>
						<input
							name="unitCost"
							inputmode="decimal"
							required
							bind:value={row.unitCost}
							class={field}
						/>
					</label>
					<Button
						type="button"
						variant="ghost"
						disabled={rows.length === 1}
						onclick={() => (rows = rows.filter((r) => r.key !== row.key))}>Quitar</Button
					>
				</div>
			{/each}
		</div>
		<button
			type="button"
			class="mt-3 text-sm text-teal-700 hover:underline"
			onclick={() => rows.push({ key: nextKey++, productId: '', quantity: '', unitCost: '' })}
			>+ Agregar producto</button
		>
	</div>

	<div><Button type="submit" loading={submitting}>{submitLabel}</Button></div>
</form>
