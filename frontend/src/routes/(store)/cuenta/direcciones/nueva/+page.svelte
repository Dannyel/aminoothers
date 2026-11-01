<script lang="ts">
	import AddressForm from '#lib/components/AddressForm.svelte';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<PageHeading title="Nueva dirección" />
<AddressForm
	departments={data.departments}
	address={form?.values}
	messages={form?.messages}
	submitLabel="Guardar dirección"
	showDefault
/>
