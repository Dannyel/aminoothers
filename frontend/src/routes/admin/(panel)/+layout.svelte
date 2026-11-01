<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ADMIN_MENU } from '#lib/admin-menu.ts';
	import { can } from '#lib/utils/labels.ts';
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

<div class="min-h-screen bg-slate-100 md:flex">
	<aside
		class="border-b border-slate-800 bg-slate-900 text-slate-200 md:min-h-screen md:w-60 md:shrink-0 md:border-b-0"
	>
		<div class="flex items-center justify-between px-4 py-4">
			<a href={resolve('admin')} class="font-semibold text-white">Farmacia · Panel</a>
			<button
				class="rounded p-1 text-slate-300 hover:bg-slate-800 md:hidden"
				aria-expanded={menuOpen}
				aria-controls="admin-menu"
				onclick={() => (menuOpen = !menuOpen)}
			>
				<span class="sr-only">Menú</span>
				<svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><path d="M4 6h16M4 12h16M4 18h16" /></svg
				>
			</button>
		</div>
		<nav id="admin-menu" class="{menuOpen ? 'block' : 'hidden'} px-2 pb-4 md:block">
			{#each sections as section (section.title)}
				<p class="mt-4 px-2 text-xs font-medium tracking-wide text-slate-500 uppercase">
					{section.title}
				</p>
				<ul class="mt-1">
					{#each section.items as item (item.href)}
						<li>
							<a
								href={item.href}
								aria-current={isActive(item.match) ? 'page' : undefined}
								class="block rounded-md px-2 py-1.5 text-sm {isActive(item.match)
									? 'bg-slate-800 text-white'
									: 'hover:bg-slate-800 hover:text-white'}">{item.label}</a
							>
						</li>
					{/each}
				</ul>
			{/each}
		</nav>
	</aside>

	<div class="flex min-w-0 flex-1 flex-col">
		<header
			class="flex items-center justify-end gap-4 border-b border-slate-200 bg-white px-6 py-3"
		>
			<a href={resolve('admin/cuenta')} class="text-sm text-slate-700 hover:text-teal-800">
				{data.staff.firstName}
				{data.staff.lastName}
			</a>
			<form method="post" action="/logout">
				<button class="text-sm text-slate-500 hover:text-slate-800">Salir</button>
			</form>
		</header>
		<main class="flex-1 p-4 sm:p-6">{@render children()}</main>
	</div>
</div>
