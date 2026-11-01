<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Lot } from '#lib/api/types.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import { LOT_STATUS_LABELS, REASON_LABELS } from '#lib/utils/labels.ts';

	/** Formularios de ajuste, baja y estado de un lote (acciones de lot-actions.ts). */
	let { lot, canAdjust, canQuarantine }: { lot: Lot; canAdjust: boolean; canQuarantine: boolean } =
		$props();

	const field =
		'rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600';
	const adjustReasons = ['COUNT_CORRECTION', 'ENTRY_ERROR', 'FOUND', 'LOSS', 'OTHER'];
	const outflowReasons = ['EXPIRED', 'DAMAGED', 'RECALL', 'RETURN_TO_SUPPLIER', 'OTHER'];
	const statuses = Object.entries(LOT_STATUS_LABELS).filter(([value]) => value !== lot.status);
	const free = $derived(lot.qtyOnHand - lot.qtyReserved);
</script>

<details class="text-sm">
	<summary class="cursor-pointer text-teal-700 hover:underline">Acciones</summary>
	<div class="mt-3 grid gap-4 md:grid-cols-3">
		{#if canAdjust}
			<form method="post" action="?/adjust" class="flex flex-col gap-2" use:enhance>
				<p class="font-medium text-slate-800">Ajuste</p>
				<input type="hidden" name="lotId" value={lot.id} />
				<select name="direction" class={field} aria-label="Tipo de ajuste">
					<option value="IN">Entrada (+)</option>
					<option value="OUT">Salida (−)</option>
				</select>
				<input
					name="quantity"
					type="number"
					min="1"
					required
					placeholder="Cantidad"
					class={field}
					aria-label="Cantidad"
				/>
				<select name="reasonCode" class={field} aria-label="Motivo">
					{#each adjustReasons as reason (reason)}<option value={reason}
							>{REASON_LABELS[reason]}</option
						>{/each}
				</select>
				<input
					name="notes"
					required
					maxlength={500}
					placeholder="Explicación (obligatoria)"
					class={field}
					aria-label="Explicación"
				/>
				<input
					name="correctsMovementNumber"
					type="number"
					min="1"
					placeholder="N.º de movimiento que corrige (opcional)"
					class={field}
					aria-label="Movimiento que corrige"
				/>
				<Button type="submit" variant="secondary">Registrar ajuste</Button>
			</form>

			{#if free > 0}
				<form method="post" action="?/outflow" class="flex flex-col gap-2" use:enhance>
					<p class="font-medium text-slate-800">Baja (máx. {free})</p>
					<input type="hidden" name="lotId" value={lot.id} />
					<input
						name="quantity"
						type="number"
						min="1"
						max={free}
						required
						placeholder="Cantidad"
						class={field}
						aria-label="Cantidad"
					/>
					<select name="reasonCode" class={field} aria-label="Motivo">
						{#each outflowReasons as reason (reason)}<option value={reason}
								>{REASON_LABELS[reason]}</option
							>{/each}
					</select>
					<input
						name="notes"
						maxlength={500}
						placeholder="Observaciones"
						class={field}
						aria-label="Observaciones"
					/>
					<Button type="submit" variant="danger">Registrar baja</Button>
				</form>
			{/if}
		{/if}

		{#if canQuarantine}
			<form method="post" action="?/status" class="flex flex-col gap-2" use:enhance>
				<p class="font-medium text-slate-800">Estado</p>
				<input type="hidden" name="lotId" value={lot.id} />
				<select name="status" class={field} aria-label="Nuevo estado">
					{#each statuses as [value, label] (value)}<option {value}>{label}</option>{/each}
				</select>
				<input
					name="reason"
					maxlength={300}
					placeholder="Motivo (obligatorio salvo al liberar)"
					class={field}
					aria-label="Motivo"
				/>
				<Button type="submit" variant="secondary">Cambiar estado</Button>
			</form>
		{/if}
	</div>
</details>
