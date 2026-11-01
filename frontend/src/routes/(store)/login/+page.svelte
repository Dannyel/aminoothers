<script lang="ts">
	import { resolve } from '$app/paths';
	import AuthCard from '#lib/components/AuthCard.svelte';
	import LoginForm from '#lib/components/LoginForm.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<AuthCard title="Iniciar sesión" subtitle="Ingrese para comprar y ver sus pedidos.">
	<LoginForm {form} />
	{#snippet footer()}
		¿No tiene cuenta? <a
			href={resolve('registro')}
			class="font-medium text-teal-700 hover:underline">Regístrese</a
		>
	{/snippet}
</AuthCard>
