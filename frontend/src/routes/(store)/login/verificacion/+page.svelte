<script lang="ts">
	import { resolve } from '$app/paths';
	import AuthCard from '#lib/components/AuthCard.svelte';
	import MfaVerifyForm from '#lib/components/MfaVerifyForm.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<AuthCard title="Verificación en dos pasos" subtitle="Ingrese el código de su app autenticadora.">
	<MfaVerifyForm {form} loginHref={resolve('login')} />
</AuthCard>
