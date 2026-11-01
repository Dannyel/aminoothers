<script lang="ts">
	import { resolve } from '$app/paths';
	import AuthCard from '#lib/components/AuthCard.svelte';
	import MfaEnrollment from '#lib/components/MfaEnrollment.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<AuthCard
	title="Proteja su cuenta"
	subtitle="Para cuidar sus datos de salud y sus compras, la cuenta exige una app autenticadora además de la contraseña."
>
	<MfaEnrollment enrollment={data.enrollment} {form} loginHref={resolve('login')} />
</AuthCard>
