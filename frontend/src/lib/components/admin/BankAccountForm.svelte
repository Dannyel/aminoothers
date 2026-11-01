<script lang="ts">
	import { enhance } from '$app/forms';
	import type { BankAccount } from '#lib/api/types.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';

	let {
		account,
		action,
		submitLabel
	}: { account?: Partial<BankAccount>; action: string; submitLabel: string } = $props();
</script>

<form
	method="post"
	{action}
	class="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 sm:grid-cols-2"
	use:enhance={() =>
		async ({ update }) =>
			update({ reset: !account?.id })}
>
	<TextField
		label="Banco"
		name="bankName"
		required
		maxlength={100}
		value={account?.bankName ?? ''}
	/>
	<TextField
		label="Número de cuenta"
		name="accountNumber"
		required
		maxlength={50}
		pattern={'[0-9-]{4,50}'}
		value={account?.accountNumber ?? ''}
	/>
	<TextField
		label="Tipo de cuenta"
		name="accountType"
		required
		maxlength={30}
		hint="Monetaria, ahorro…"
		value={account?.accountType ?? ''}
	/>
	<TextField
		label="Titular"
		name="accountHolder"
		required
		maxlength={150}
		value={account?.accountHolder ?? ''}
	/>
	<div class="sm:col-span-2">
		<TextField
			label="Instrucciones para el cliente"
			name="instructions"
			maxlength={500}
			value={account?.instructions ?? ''}
		/>
	</div>
	<TextField
		label="Orden"
		name="sortOrder"
		type="number"
		min={0}
		max={1000}
		value={account?.sortOrder ?? 0}
	/>
	<label class="flex items-end gap-2 text-sm text-slate-700">
		<input
			type="checkbox"
			name="isActive"
			checked={account?.isActive ?? true}
			class="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
		/>
		Visible para los clientes
	</label>
	<div class="sm:col-span-2"><Button type="submit">{submitLabel}</Button></div>
</form>
