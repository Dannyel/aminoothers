<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import AuthCard from '#lib/components/AuthCard.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let submitting = $state(false);
	const values = $derived(form && 'values' in form ? form.values : undefined);
</script>

<AuthCard title="Crear cuenta" subtitle="Solo los clientes registrados pueden comprar.">
	{#if form && 'success' in form}
		<Alert variant="success" messages={form.success} />
		<p class="mt-4 text-sm text-slate-600">
			Cuando confirme su correo podrá <a
				href={resolve('login')}
				class="text-teal-700 hover:underline">iniciar sesión</a
			> y comprar.
		</p>
	{:else}
		<form
			method="post"
			class="flex flex-col gap-4"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update({ reset: false });
					submitting = false;
				};
			}}
		>
			<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />
			<div class="grid gap-4 sm:grid-cols-2">
				<TextField
					label="Nombre"
					name="firstName"
					autocomplete="given-name"
					required
					maxlength={100}
					value={values?.firstName ?? ''}
				/>
				<TextField
					label="Apellido"
					name="lastName"
					autocomplete="family-name"
					required
					maxlength={100}
					value={values?.lastName ?? ''}
				/>
			</div>
			<TextField
				label="Correo electrónico"
				name="email"
				type="email"
				autocomplete="email"
				required
				value={values?.email ?? ''}
			/>
			<TextField
				label="Teléfono"
				name="phone"
				type="tel"
				autocomplete="tel"
				value={values?.phone ?? ''}
			/>
			<TextField
				label="Contraseña"
				name="password"
				type="password"
				autocomplete="new-password"
				required
				minlength={10}
				hint="Mínimo 10 caracteres, con al menos una letra y un número."
			/>
			<TextField
				label="Confirmar contraseña"
				name="passwordConfirm"
				type="password"
				autocomplete="new-password"
				required
			/>
			<Button type="submit" loading={submitting}>Crear cuenta</Button>
		</form>
	{/if}
	{#snippet footer()}
		¿Ya tiene cuenta? <a href={resolve('login')} class="font-medium text-teal-700 hover:underline"
			>Inicie sesión</a
		>
	{/snippet}
</AuthCard>
