<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ADMIN_MENU } from '#lib/admin-menu.ts';
	import { can } from '#lib/utils/labels.ts';
	import Icon from '#lib/components/ui/Icon.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	let menuOpen = $state(false);

	const sections = $derived(
		ADMIN_MENU.map((section) => ({
			...section,
			items: section.items.filter((i) => i.permission === null || can(data.staff, i.permission))
		})).filter((section) => section.items.length > 0)
	);

	const isActive = (match: string) =>
		match === '/admin' ? page.url.pathname === match : page.url.pathname.startsWith(match);

	// Cierra el menú móvil al navegar.
	$effect(() => {
		void page.url.pathname;
		menuOpen = false;
	});
</script>

<!-- Los enlaces del menú se resuelven con resolve() en admin-menu.ts. -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

<a
	href="#contenido"
	class="sr-only z-50 rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
	>Saltar al contenido</a
>

<div class="min-h-screen bg-canvas md:flex">
	<aside
		class="bg-stone-950 text-stone-400 md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col"
	>
		<div class="flex items-center justify-between px-4 py-4 md:py-5">
			<a
				href={resolve('admin')}
				class="flex items-center gap-2.5 font-display font-semibold text-white"
			>
				<span
					class="flex size-9 items-center justify-center rounded-lg bg-white font-semibold text-stone-950"
					aria-hidden="true">A</span
				>
				<span class="leading-tight">
					Administración
					<span class="block text-xs font-normal text-stone-400">Panel de la tienda</span>
				</span>
			</a>
			<button
				class="flex size-11 items-center justify-center rounded-lg text-stone-300 transition-colors duration-200 hover:bg-stone-800 md:hidden"
				aria-expanded={menuOpen}
				aria-controls="admin-menu"
				onclick={() => (menuOpen = !menuOpen)}
			>
				<span class="sr-only">Menú</span>
				<Icon name={menuOpen ? 'close' : 'menu'} class="size-6" />
			</button>
		</div>
		<nav
			id="admin-menu"
			class="{menuOpen ? 'block' : 'hidden'} px-3 pb-6 md:block md:flex-1 md:overflow-y-auto"
		>
			{#each sections as section (section.title)}
				<p
					class="mt-5 mb-1.5 px-3 text-[0.7rem] font-semibold tracking-wider text-stone-500 uppercase first:mt-1"
				>
					{section.title}
				</p>
				<ul class="flex flex-col gap-0.5">
					{#each section.items as item (item.href)}
						<li>
							<a
								href={item.href}
								aria-current={isActive(item.match) ? 'page' : undefined}
								class="relative flex min-h-9 items-center rounded-lg px-3 text-sm transition-colors duration-150 {isActive(
									item.match
								)
									? 'bg-white/10 font-medium text-white before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-accent-500'
									: 'hover:bg-white/5 hover:text-white'}">{item.label}</a
							>
						</li>
					{/each}
				</ul>
			{/each}
		</nav>
	</aside>

	<div class="flex min-w-0 flex-1 flex-col">
		<header
			class="sticky top-0 z-20 flex min-h-16 items-center justify-end gap-2 border-b border-stone-200 bg-canvas/90 px-4 backdrop-blur-md sm:px-8"
		>
			<a
				href={resolve('admin/cuenta')}
				class="flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-sm font-medium text-stone-700 transition-colors duration-200 hover:bg-stone-100"
			>
				<span
					class="flex size-8 items-center justify-center rounded-full bg-stone-900 text-xs font-medium text-white"
					aria-hidden="true">{data.staff.firstName.charAt(0)}{data.staff.lastName.charAt(0)}</span
				>
				{data.staff.firstName}
				{data.staff.lastName}
			</a>
			<form method="post" action="/logout">
				<button
					class="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-stone-500 transition-colors duration-200 hover:bg-stone-100 hover:text-stone-800"
				>
					<Icon name="logout" class="size-4" /> Salir
				</button>
			</form>
		</header>
		<main id="contenido" class="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-8">
			{@render children()}
		</main>
	</div>
</div>
