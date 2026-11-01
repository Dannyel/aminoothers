<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { PurchaseOrderDetail } from '#lib/api/types.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';

	/** Una fila por lote recibido; una línea de la orden puede llegar en varios lotes. */
	let { order }: { order: PurchaseOrderDetail } = $props();

	type Row = { key: number; itemId: string };
	let nextKey = 0;
	const pendingItems = $derived(order.items.filter((i) => i.quantityPending > 0));
	let rows = $state<Row[]>(
		untrack(() =>
			order.items
				.filter((i) => i.quantityPending > 0)
				.map((i) => ({ key: nextKey++, itemId: i.id }))
		)
	);
	let submitting = $state(false);
	const itemFor = (id: string) => order.items.find((i) => i.id === id)!;
	const field =
		'w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600';

	function addLot(itemId: string, after: number) {
		const index = rows.findIndex((r) => r.key === after);
		rows.splice(index + 1, 0, { key: nextKey++, itemId });
	}
</script>

<form
	method="post"
	action="?/receive"
	class="flex flex-col gap-4"
	use:enhance={() => {
		submitting = true;
		return async ({ update }) => {
			await update();
			submitting = false;
		};
	}}
>
	<div class="grid gap-4 sm:grid-cols-2">
		<TextField label="Factura del proveedor" name="supplierInvoiceNumber" maxlength={50} />
		<TextField label="Notas" name="notes" maxlength={1000} />
	</div>
	<div class="overflow-x-auto">
		<table class="min-w-full text-sm">
			<thead class="text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
				<tr>
					<th class="py-2 pr-3">Producto</th>
					<th class="py-2 pr-3">Lote</th>
					<th class="py-2 pr-3">Vencimiento</th>
					<th class="py-2 pr-3">Cantidad</th>
					<th class="py-2 pr-3">Costo unit. (Q)</th>
					<th class="py-2 pr-3">Estado</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.key)}
					{@const item = itemFor(row.itemId)}
					<tr class="align-top">
						<td class="py-2 pr-3">
							<input type="hidden" name="purchaseOrderItemId" value={row.itemId} />
							<p class="font-medium text-slate-800">{item.product.name}</p>
							<p class="text-xs text-slate-500">Pendiente: {item.quantityPending}</p>
						</td>
						<td class="py-2 pr-3"
							><input
								name="lotNumber"
								maxlength={50}
								class={field}
								aria-label="Número de lote"
							/></td
						>
						<td class="py-2 pr-3"
							><input
								name="expirationDate"
								type="date"
								class={field}
								aria-label="Vencimiento"
							/></td
						>
						<td class="py-2 pr-3">
							<input
								name="quantity"
								type="number"
								min="0"
								max={item.quantityPending}
								class="{field} w-24"
								aria-label="Cantidad recibida"
							/>
						</td>
						<td class="py-2 pr-3">
							<input
								name="unitCost"
								inputmode="decimal"
								value={item.unitCost}
								class="{field} w-28"
								aria-label="Costo unitario"
							/>
						</td>
						<td class="py-2 pr-3">
							<select name="initialStatus" class={field} aria-label="Estado inicial">
								<option value="AVAILABLE">Disponible</option>
								<option value="QUARANTINE">Cuarentena</option>
							</select>
						</td>
						<td class="py-2">
							<button
								type="button"
								class="text-xs whitespace-nowrap text-teal-700 hover:underline"
								onclick={() => addLot(row.itemId, row.key)}>+ otro lote</button
							>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="text-xs text-slate-500">
		Deje la cantidad vacía en las líneas que no llegaron. El vencimiento es obligatorio para
		medicamentos. Toda la recepción se registra o, si hay un error, no se registra nada.
	</p>
	{#if pendingItems.length > 0}
		<div><Button type="submit" loading={submitting}>Registrar recepción</Button></div>
	{/if}
</form>
