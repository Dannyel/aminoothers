<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import type { Address, AddressInput } from '#lib/api/types.ts';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import SelectField from '#lib/components/ui/SelectField.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';

	let {
		departments,
		address,
		messages,
		submitLabel,
		showDefault = false
	}: {
		departments: readonly string[];
		address?: Partial<Address | AddressInput>;
		messages?: string[];
		submitLabel: string;
		showDefault?: boolean;
	} = $props();

	let submitting = $state(false);
	const departmentOptions = $derived(departments.map((d) => ({ value: d, label: d })));
</script>

<form
	method="post"
	class="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6"
	use:enhance={() => {
		submitting = true;
		return async ({ update }) => {
			await update({ reset: false });
			submitting = false;
		};
	}}
>
	<Alert variant="error" {messages} />
	<div class="grid gap-4 sm:grid-cols-2">
		<TextField
			label="Nombre de la dirección"
			name="label"
			required
			maxlength={50}
			placeholder="Casa, Trabajo…"
			value={address?.label ?? ''}
		/>
		<TextField
			label="Quién recibe"
			name="recipientName"
			required
			maxlength={150}
			autocomplete="name"
			value={address?.recipientName ?? ''}
		/>
		<TextField
			label="Teléfono de contacto"
			name="phone"
			type="tel"
			required
			autocomplete="tel"
			value={address?.phone ?? ''}
		/>
		<SelectField
			label="Departamento"
			name="department"
			required
			placeholder="Seleccione…"
			options={departmentOptions}
			value={address?.department ?? ''}
		/>
		<TextField
			label="Municipio"
			name="municipality"
			required
			maxlength={100}
			value={address?.municipality ?? ''}
		/>
		<TextField label="Zona" name="zone" maxlength={20} value={address?.zone ?? ''} />
	</div>
	<TextField
		label="Dirección"
		name="addressLine1"
		required
		maxlength={200}
		autocomplete="address-line1"
		placeholder="Calle, avenida, número de casa"
		value={address?.addressLine1 ?? ''}
	/>
	<TextField
		label="Complemento"
		name="addressLine2"
		maxlength={200}
		autocomplete="address-line2"
		placeholder="Colonia, edificio, apartamento"
		value={address?.addressLine2 ?? ''}
	/>
	<TextField
		label="Referencias para el mensajero"
		name="reference"
		maxlength={300}
		value={address?.reference ?? ''}
	/>
	{#if showDefault}
		<label class="flex items-center gap-2 text-sm text-slate-700">
			<input
				type="checkbox"
				name="isDefault"
				class="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
			/>
			Usar como dirección predeterminada
		</label>
	{/if}
	<div class="flex gap-2">
		<Button type="submit" loading={submitting}>{submitLabel}</Button>
		<a
			href={resolve('cuenta/direcciones')}
			class="rounded-md px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Cancelar</a
		>
	</div>
</form>
