<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	const customer = $derived(data.user?.type === 'CUSTOMER' ? data.user : null);
	const info = $derived(data.info);
	const catalogPath = resolve('productos');
	const search = $derived(
		page.url.pathname === catalogPath ? (page.url.searchParams.get('q') ?? '') : ''
	);
</script>

<!-- Los enlaces a categorías se arman sobre catalogPath, resuelto con resolve(). -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

<div class="flex min-h-screen flex-col bg-slate-50">
	<header class="border-b border-slate-200 bg-white">
		<div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
			<a href={resolve('')} class="flex items-center gap-2 text-lg font-semibold text-teal-800">
				{#if info.logoFileId}
					<img src="/media/{info.logoFileId}" alt="" class="h-9 w-auto" />
				{/if}
				{info.tradeName}
			</a>

			<form
				method="get"
				action={catalogPath}
				role="search"
				class="order-last flex w-full flex-1 sm:order-none sm:w-auto"
			>
				<label for="store-search" class="sr-only">Buscar productos</label>
				<input
					id="store-search"
					type="search"
					name="q"
					value={search}
					maxlength={100}
					placeholder="Buscar por nombre, marca o principio activo"
					class="w-full rounded-l-md border-slate-300 text-sm focus:border-teal-600 focus:ring-teal-600"
				/>
				<button
					class="rounded-r-md bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800"
				>
					Buscar
				</button>
			</form>

			<nav class="ml-auto flex items-center gap-4 text-sm" aria-label="Cuenta">
				<a href={resolve('carrito')} class="relative text-slate-700 hover:text-teal-800">
					Carrito
					{#if data.cartCount > 0}
						<span
							class="ml-1 rounded-full bg-teal-700 px-2 py-0.5 text-xs font-semibold text-white"
							aria-label="{data.cartCount} unidades">{data.cartCount}</span
						>
					{/if}
				</a>
				{#if customer}
					<a href={resolve('cuenta/pedidos')} class="text-slate-700 hover:text-teal-800">
						Mis pedidos
					</a>
					<a href={resolve('cuenta/perfil')} class="text-slate-700 hover:text-teal-800">
						{customer.firstName}
					</a>
					<form method="post" action="/logout">
						<button class="text-slate-500 hover:text-slate-800">Salir</button>
					</form>
				{:else}
					<a href={resolve('login')} class="text-slate-700 hover:text-teal-800">Iniciar sesión</a>
					<a
						href={resolve('registro')}
						class="rounded-md bg-teal-700 px-3 py-1.5 font-medium text-white hover:bg-teal-800"
						>Crear cuenta</a
					>
				{/if}
			</nav>
		</div>
		{#if data.categories.length > 0}
			<nav class="border-t border-slate-100" aria-label="Categorías">
				<ul class="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 text-sm">
					<li>
						<a
							href={resolve('categorias')}
							class="block rounded-md px-3 py-1 whitespace-nowrap text-slate-700 hover:bg-slate-100"
							>Todas</a
						>
					</li>
					{#each data.categories as category (category.id)}
						{@const active = page.url.searchParams.get('categoria') === category.slug}
						<li>
							<a
								href="{catalogPath}?categoria={category.slug}"
								aria-current={active ? 'page' : undefined}
								class="block rounded-md px-3 py-1 whitespace-nowrap {active
									? 'bg-teal-50 font-medium text-teal-800'
									: 'text-slate-700 hover:bg-slate-100'}">{category.name}</a
							>
						</li>
					{/each}
				</ul>
			</nav>
		{/if}
	</header>

	<main class="flex-1">
		{@render children()}
	</main>

	<footer class="border-t border-slate-200 bg-white text-sm text-slate-600">
		<div class="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-3">
			<div>
				<p class="font-semibold text-slate-800">{info.tradeName}</p>
				{#if info.legalName}<p>{info.legalName}</p>{/if}
				{#if info.taxId}<p>NIT {info.taxId}</p>{/if}
				{#if info.fiscalAddress}<p>{info.fiscalAddress}</p>{/if}
			</div>
			<div>
				<p class="font-semibold text-slate-800">Contacto</p>
				{#if info.phone}<p>Teléfono: {info.phone}</p>{/if}
				{#if info.whatsapp}<p>WhatsApp: {info.whatsapp}</p>{/if}
				{#if info.email}<p>{info.email}</p>{/if}
				{#if info.businessHours}<p>{info.businessHours}</p>{/if}
			</div>
			<div>
				{#if info.sanitaryLicense}<p>Licencia sanitaria: {info.sanitaryLicense}</p>{/if}
				{#if info.regentName}<p>Regente farmacéutico: {info.regentName}</p>{/if}
			</div>
		</div>
		<p class="mx-auto max-w-6xl border-t border-slate-100 px-4 py-4 text-xs text-slate-500">
			{info.regulatoryNotice}
		</p>
	</footer>
</div>
