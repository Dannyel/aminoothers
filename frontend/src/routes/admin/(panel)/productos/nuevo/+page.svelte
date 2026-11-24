<script lang="ts">
	import { resolve } from '$app/paths';
	import ProductForm from '#lib/components/admin/ProductForm.svelte';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<PageHeading
	title="Nuevo producto"
	description="Las imágenes y la habilitación de venta en línea se agregan después de crearlo."
>
	{#snippet actions()}
		<a
			href={resolve('admin/productos')}
			class="rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-stone-200">← Volver</a
		>
	{/snippet}
</PageHeading>

<div class="max-w-4xl">
	<ProductForm options={data.options} messages={form?.messages} submitLabel="Crear producto" />
</div>
