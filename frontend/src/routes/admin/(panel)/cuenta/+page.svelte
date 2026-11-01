<script lang="ts">
	import PageHeading from '#lib/components/PageHeading.svelte';
	import SecurityForms from '#lib/components/SecurityForms.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<PageHeading title="Mi cuenta" description={data.staff.email} />
<SecurityForms {form} mfa={data.mfa} />
