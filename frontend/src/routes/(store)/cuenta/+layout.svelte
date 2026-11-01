<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const links = [
		{ href: 'cuenta/pedidos', label: 'Mis pedidos' },
		{ href: 'cuenta/perfil', label: 'Perfil' },
		{ href: 'cuenta/direcciones', label: 'Direcciones' },
		{ href: 'cuenta/seguridad', label: 'Seguridad' }
	] as const;
</script>

<div class="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-[200px_1fr]">
	<nav aria-label="Mi cuenta">
		<ul class="flex gap-2 overflow-x-auto md:flex-col">
			{#each links as link (link.href)}
				{@const active = page.url.pathname.startsWith(`/${link.href}`)}
				<li>
					<a
						href={resolve(link.href)}
						aria-current={active ? 'page' : undefined}
						class="block rounded-md px-3 py-2 text-sm whitespace-nowrap {active
							? 'bg-teal-50 font-medium text-teal-800'
							: 'text-slate-700 hover:bg-slate-100'}">{link.label}</a
					>
				</li>
			{/each}
		</ul>
	</nav>
	<div class="min-w-0">{@render children()}</div>
</div>
