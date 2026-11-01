<script lang="ts">
	import PageHeading from '#lib/components/PageHeading.svelte';
	import SecurityForms from '#lib/components/SecurityForms.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<PageHeading title="Seguridad" />
<SecurityForms {form} mfa={data.mfa} />
