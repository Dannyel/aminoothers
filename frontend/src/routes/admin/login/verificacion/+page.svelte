<script lang="ts">
	import { resolve } from '$app/paths';
	import AdminAuthCard from '#lib/components/admin/AdminAuthCard.svelte';
	import MfaVerifyForm from '#lib/components/MfaVerifyForm.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<AdminAuthCard title="Verificación en dos pasos">
	<MfaVerifyForm {form} loginHref={resolve('admin/login')} />
</AdminAuthCard>
