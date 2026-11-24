<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Courier } from '#lib/api/types.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';

	let {
		courier,
		action,
		submitLabel
	}: { courier?: Partial<Courier>; action: string; submitLabel: string } = $props();
</script>

<form
	method="post"
	{action}
	class="card grid gap-4 p-6 sm:grid-cols-2"
	use:enhance={() =>
		async ({ update }) =>
			update({ reset: !courier?.id })}
>
	<TextField label="Nombre" name="name" required maxlength={100} value={courier?.name ?? ''} />
	<TextField label="Teléfono" name="phone" type="tel" maxlength={30} value={courier?.phone ?? ''} />
	<TextField
		label="Sitio web"
		name="website"
		type="url"
		maxlength={200}
		value={courier?.website ?? ''}
	/>
	<TextField
		label="URL de rastreo"
		name="trackingUrlTemplate"
		maxlength={300}
		hint="Use {'{tracking}'} donde va el número de guía, p. ej. https://ejemplo.gt/rastreo?guia={'{tracking}'}"
		value={courier?.trackingUrlTemplate ?? ''}
	/>
	<label class="flex items-center gap-2 text-sm text-stone-700">
		<input
			type="checkbox"
			name="isActive"
			checked={courier?.isActive ?? true}
			class="rounded border-stone-300 text-brand-700 focus:ring-brand-600"
		/>
		Activa
	</label>
	<div class="sm:col-span-2"><Button type="submit">{submitLabel}</Button></div>
</form>
