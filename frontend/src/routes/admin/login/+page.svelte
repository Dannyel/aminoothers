<script lang="ts">
	import AdminAuthCard from '#lib/components/admin/AdminAuthCard.svelte';
	import LoginForm from '#lib/components/LoginForm.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<AdminAuthCard title="Iniciar sesión">
	<LoginForm {form} />
</AdminAuthCard>
