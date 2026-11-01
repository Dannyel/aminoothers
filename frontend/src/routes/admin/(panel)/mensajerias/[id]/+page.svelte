<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import CourierForm from '#lib/components/admin/CourierForm.svelte';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import ConfirmButton from '#lib/components/ui/ConfirmButton.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<PageHeading title={data.row.name}>
	{#snippet actions()}
		<a
			href={resolve('admin/mensajerias')}
			class="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-200">← Volver</a
		>
	{/snippet}
</PageHeading>

<div class="flex max-w-3xl flex-col gap-4">
	<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
	<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />
	<CourierForm courier={data.row} action="?/update" submitLabel="Guardar" />
	<form method="post" action="?/remove" use:enhance>
		<ConfirmButton
			message="¿Dar de baja esta mensajería? Los registros existentes la conservan."
			confirmLabel="Dar de baja"
		>
			Dar de baja
		</ConfirmButton>
	</form>
</div>
