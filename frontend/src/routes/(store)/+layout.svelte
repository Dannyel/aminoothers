<script lang="ts">
	import { resolve } from '$app/paths';
	import { navigating, page } from '$app/state';
	import BrandMark from '#lib/components/store/BrandMark.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	const customer = $derived(data.user?.type === 'CUSTOMER' ? data.user : null);
	const info = $derived(data.info);
	const catalogPath = resolve('productos');
	const search = $derived(
		page.url.pathname === catalogPath ? (page.url.searchParams.get('q') ?? '') : ''
	);
	const activeCategory = $derived(
		page.url.pathname === catalogPath ? page.url.searchParams.get('categoria') : null
	);
	const year = new Date().getFullYear();

	const iconLink =
		'relative flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-2.5 text-sm font-medium text-stone-700 transition-colors duration-200 hover:bg-stone-100 hover:text-stone-950';
	const footerLink = 'transition-colors duration-200 hover:text-stone-950';
</script>

<!-- Los enlaces a categorías se arman sobre catalogPath, resuelto con resolve(). -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

<a
	href="#contenido"
	class="sr-only z-50 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
	>Saltar al contenido</a
>

<!-- Barra de progreso de la navegación: feedback inmediato al cambiar de página. -->
{#if navigating.to}
	<div
		class="fixed inset-x-0 top-0 z-50 h-0.5 origin-left animate-pulse bg-accent-600"
		role="progressbar"
		aria-label="Cargando"
	></div>
{/if}

<div class="flex min-h-screen flex-col">
	<p
		class="bg-stone-950 px-4 py-2 text-center text-xs tracking-wide text-stone-300 [&_strong]:font-medium [&_strong]:text-white"
	>
		<strong>Entrega a domicilio</strong> · Pague por transferencia o en efectivo al recibir
	</p>

	<header class="sticky top-0 z-30 border-b border-stone-200 bg-canvas/90 backdrop-blur-md">
		<div
			class="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6 lg:grid-cols-[auto_1fr_auto] lg:gap-x-10"
		>
			<a
				href={resolve('')}
				class="justify-self-start lg:col-start-1 lg:row-start-1"
				aria-label="{info.tradeName}, inicio"
			>
				<BrandMark name={info.tradeName} logoFileId={info.logoFileId} />
			</a>

			<form
				method="get"
				action={catalogPath}
				role="search"
				class="relative col-span-2 row-start-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:mx-auto lg:w-full lg:max-w-xl"
			>
				<label for="store-search" class="sr-only">Buscar productos</label>
				<Icon
					name="search"
					class="pointer-events-none absolute top-1/2 left-4 size-[1.125rem] -translate-y-1/2 text-stone-500"
				/>
				<input
					id="store-search"
					type="search"
					name="q"
					value={search}
					maxlength={100}
					placeholder="Buscar productos, marcas o ingredientes"
					class="min-h-11 w-full rounded-full! border-stone-200! bg-white py-2 pr-4 pl-11 text-sm"
				/>
			</form>

			<nav
				class="col-start-2 row-start-1 flex items-center gap-0.5 justify-self-end lg:col-start-3"
				aria-label="Cuenta"
			>
				{#if customer}
					<a href={resolve('cuenta/pedidos')} class={iconLink}>
						<Icon name="package" class="size-5" strokeWidth={1.75} />
						<span class="sr-only xl:not-sr-only">Pedidos</span>
					</a>
					<a href={resolve('cuenta/perfil')} class={iconLink}>
						<Icon name="user" class="size-5" strokeWidth={1.75} />
						<span class="sr-only xl:not-sr-only">{customer.firstName}</span>
					</a>
				{:else}
					<a href={resolve('login')} class={iconLink}>
						<Icon name="user" class="size-5" strokeWidth={1.75} />
						<span class="sr-only sm:not-sr-only">Ingresar</span>
					</a>
				{/if}
				<a
					href={resolve('carrito')}
					class={iconLink}
					aria-current={page.url.pathname === resolve('carrito') ? 'page' : undefined}
				>
					<Icon name="bag" class="size-5" strokeWidth={1.75} />
					<span class="sr-only xl:not-sr-only">Carrito</span>
					{#if data.cartCount > 0}
						<span
							class="absolute top-1 right-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-accent-700 px-1 text-[0.6875rem] leading-none font-semibold text-white tabular-nums xl:static xl:h-5 xl:min-w-5"
							aria-label="{data.cartCount} unidades">{data.cartCount}</span
						>
					{/if}
				</a>
				{#if customer}
					<form method="post" action="/logout">
						<button class={iconLink}>
							<Icon name="logout" class="size-5" strokeWidth={1.75} />
							<span class="sr-only">Salir</span>
						</button>
					</form>
				{/if}
			</nav>
		</div>

		{#if data.categories.length > 0}
			<nav aria-label="Categorías" class="border-t border-stone-200/70">
				<ul
					class="mx-auto flex max-w-7xl [scrollbar-width:none] gap-6 overflow-x-auto px-4 text-sm sm:px-6 lg:justify-center lg:gap-8"
				>
					<li>
						<a
							href={catalogPath}
							aria-current={page.url.pathname === catalogPath && !activeCategory
								? 'page'
								: undefined}
							class="flex min-h-11 items-center border-b-2 whitespace-nowrap transition-colors duration-200 {page
								.url.pathname === catalogPath && !activeCategory
								? 'border-stone-900 font-medium text-stone-950'
								: 'border-transparent text-stone-600 hover:text-stone-950'}">Todo</a
						>
					</li>
					{#each data.categories as category (category.id)}
						{@const active = activeCategory === category.slug}
						<li>
							<a
								href="{catalogPath}?categoria={category.slug}"
								aria-current={active ? 'page' : undefined}
								class="flex min-h-11 items-center border-b-2 whitespace-nowrap transition-colors duration-200 {active
									? 'border-stone-900 font-medium text-stone-950'
									: 'border-transparent text-stone-600 hover:text-stone-950'}">{category.name}</a
							>
						</li>
					{/each}
				</ul>
			</nav>
		{/if}
	</header>

	<main id="contenido" class="flex-1">
		{@render children()}
	</main>

	<footer class="mt-24 border-t border-stone-200 bg-sunken text-sm text-stone-600">
		<div
			class="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]"
		>
			<div class="flex flex-col gap-4">
				<BrandMark name={info.tradeName} logoFileId={info.logoFileId} />
				<p class="max-w-xs">
					Compre en línea y reciba en su casa. Pague por transferencia bancaria o en efectivo al
					recibir.
				</p>
			</div>
			<div>
				<p class="eyebrow mb-4 text-stone-950!">Tienda</p>
				<ul class="flex flex-col gap-2.5">
					<li><a href={catalogPath} class={footerLink}>Todos los productos</a></li>
					<li><a href={resolve('categorias')} class={footerLink}>Categorías</a></li>
					<li><a href={resolve('carrito')} class={footerLink}>Carrito</a></li>
				</ul>
			</div>
			<div>
				<p class="eyebrow mb-4 text-stone-950!">Mi cuenta</p>
				<ul class="flex flex-col gap-2.5">
					{#if customer}
						<li><a href={resolve('cuenta/pedidos')} class={footerLink}>Mis pedidos</a></li>
						<li><a href={resolve('cuenta/perfil')} class={footerLink}>Perfil</a></li>
						<li><a href={resolve('cuenta/direcciones')} class={footerLink}>Direcciones</a></li>
					{:else}
						<li><a href={resolve('login')} class={footerLink}>Iniciar sesión</a></li>
						<li><a href={resolve('registro')} class={footerLink}>Crear cuenta</a></li>
					{/if}
				</ul>
			</div>
			{#if info.phone || info.whatsapp || info.email || info.businessHours}
				<div>
					<p class="eyebrow mb-4 text-stone-950!">Contacto</p>
					<ul class="flex flex-col gap-2.5">
						{#if info.phone}<li>Teléfono {info.phone}</li>{/if}
						{#if info.whatsapp}<li>WhatsApp {info.whatsapp}</li>{/if}
						{#if info.email}<li class="break-all">{info.email}</li>{/if}
						{#if info.businessHours}<li>{info.businessHours}</li>{/if}
					</ul>
				</div>
			{/if}
		</div>
		<div class="border-t border-stone-200">
			<div
				class="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs leading-relaxed text-stone-500 sm:px-6"
			>
				<p class="flex flex-wrap gap-x-4 gap-y-1">
					<span>© {year} {info.legalName ?? info.tradeName}</span>
					{#if info.taxId}<span>NIT {info.taxId}</span>{/if}
					{#if info.fiscalAddress}<span>{info.fiscalAddress}</span>{/if}
					{#if info.sanitaryLicense}<span>Licencia sanitaria {info.sanitaryLicense}</span>{/if}
					{#if info.regentName}<span>Regente farmacéutico: {info.regentName}</span>{/if}
				</p>
				<p class="max-w-4xl">{info.regulatoryNotice}</p>
			</div>
		</div>
	</footer>
</div>
