<script lang="ts">
	import { resolve } from '$app/paths';
	import AdminAuthCard from '#lib/components/admin/AdminAuthCard.svelte';
	import MfaEnrollment from '#lib/components/MfaEnrollment.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<AdminAuthCard title="Configure el doble factor">
	<p class="mb-4 text-sm text-slate-600">
		El acceso al panel exige una app autenticadora además de la contraseña.
	</p>
	<MfaEnrollment enrollment={data.enrollment} {form} loginHref={resolve('admin/login')} />
</AdminAuthCard>
