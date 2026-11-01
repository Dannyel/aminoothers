<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Supplier } from '#lib/api/types.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';

	let {
		supplier,
		action,
		submitLabel,
		disabled = false
	}: {
		supplier?: Partial<Supplier>;
		action: string;
		submitLabel: string;
		disabled?: boolean;
	} = $props();
</script>

<form
	method="post"
	{action}
	class="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 sm:grid-cols-2"
	use:enhance={() =>
		async ({ update }) =>
			update({ reset: false })}
>
	<fieldset class="contents" {disabled}>
		<div class="sm:col-span-2">
			<TextField
				label="Nombre o razón social"
				name="name"
				required
				maxlength={200}
				value={supplier?.name ?? ''}
			/>
		</div>
		<TextField label="NIT" name="taxId" value={supplier?.taxId ?? ''} />
		<TextField
			label="Contacto"
			name="contactName"
			maxlength={150}
			value={supplier?.contactName ?? ''}
		/>
		<TextField label="Teléfono" name="phone" type="tel" value={supplier?.phone ?? ''} />
		<TextField label="Correo" name="email" type="email" value={supplier?.email ?? ''} />
		<div class="sm:col-span-2">
			<TextField label="Dirección" name="address" maxlength={300} value={supplier?.address ?? ''} />
		</div>
		<div class="sm:col-span-2">
			<TextField label="Notas" name="notes" maxlength={1000} value={supplier?.notes ?? ''} />
		</div>
		{#if supplier?.id}
			<label class="flex items-center gap-2 text-sm text-slate-700">
				<input
					type="checkbox"
					name="isActive"
					checked={supplier.isActive}
					class="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
				/>
				Activo
			</label>
		{/if}
	</fieldset>
	{#if !disabled}<div class="sm:col-span-2"><Button type="submit">{submitLabel}</Button></div>{/if}
</form>
