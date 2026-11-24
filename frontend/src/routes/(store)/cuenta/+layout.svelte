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

<div
	class="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-14 md:grid-cols-[13rem_1fr] md:gap-14"
>
	<nav aria-label="Mi cuenta">
		<p class="eyebrow mb-4 hidden md:block">Mi cuenta</p>
		<ul
			class="-mx-4 flex [scrollbar-width:none] gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0"
		>
			{#each links as link (link.href)}
				{@const active = page.url.pathname.startsWith(`/${link.href}`)}
				<li>
					<a
						href={resolve(link.href)}
						aria-current={active ? 'page' : undefined}
						class="flex min-h-10 items-center rounded-full px-4 text-sm whitespace-nowrap transition-colors duration-200 {active
							? 'bg-stone-900 font-medium text-white'
							: 'text-stone-700 hover:bg-stone-100 hover:text-stone-950'}">{link.label}</a
					>
				</li>
			{/each}
		</ul>
	</nav>
	<div class="min-w-0">{@render children()}</div>
</div>
