<script lang="ts">
	import { resolve } from '$app/paths';
	import PurchaseOrderForm from '#lib/components/admin/PurchaseOrderForm.svelte';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<PageHeading
	title="Nueva orden de compra"
	description="Se guarda como borrador hasta su aprobación."
>
	{#snippet actions()}
		<a
			href={resolve('admin/compras')}
			class="rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-stone-200">← Volver</a
		>
	{/snippet}
</PageHeading>

<div class="max-w-4xl">
	<PurchaseOrderForm
		suppliers={data.suppliers}
		products={data.products}
		messages={form?.messages}
		submitLabel="Guardar borrador"
	/>
</div>
