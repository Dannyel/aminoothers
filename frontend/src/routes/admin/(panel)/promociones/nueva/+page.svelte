<script lang="ts">
	import { resolve } from '$app/paths';
	import PromotionForm from '#lib/components/admin/PromotionForm.svelte';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<PageHeading title="Nueva promoción">
	{#snippet actions()}
		<a
			href={resolve('admin/promociones')}
			class="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-200">← Volver</a
		>
	{/snippet}
</PageHeading>

<div class="flex max-w-4xl flex-col gap-4">
	<Alert variant="error" messages={form?.messages} />
	<PromotionForm products={data.products} action="" submitLabel="Crear promoción" />
</div>
