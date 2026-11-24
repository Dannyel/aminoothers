<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '#lib/components/ui/Icon.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const catalogPath = resolve('productos');
</script>

<!-- Los enlaces se arman sobre catalogPath, resuelto con resolve(). -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

<svelte:head>
	<title>Categorías · {data.info.tradeName}</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
	<header class="mb-12">
		<p class="eyebrow">Explore</p>
		<h1 class="mt-2 text-4xl sm:text-5xl">Categorías</h1>
	</header>
	{#if data.categories.length === 0}
		<EmptyState title="Aún no hay categorías" icon="grid" />
	{:else}
		<ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.categories as category (category.id)}
				<li class="flex flex-col rounded-3xl bg-sunken p-7">
					<a
						href="{catalogPath}?categoria={category.slug}"
						class="group flex items-start justify-between gap-4"
					>
						<span>
							<span
								class="block font-display text-2xl font-medium tracking-tight text-stone-950 underline-offset-4 group-hover:underline"
								>{category.name}</span
							>
							<span class="mt-1 block text-sm text-stone-500"
								>{category.productCount}
								{category.productCount === 1 ? 'producto' : 'productos'}</span
							>
						</span>
						{#if category.imageFileId}
							<img
								src="/media/{category.imageFileId}"
								alt=""
								loading="lazy"
								class="size-16 object-contain mix-blend-multiply"
							/>
						{:else}
							<span
								class="flex size-10 items-center justify-center rounded-full bg-white transition-transform duration-300 group-hover:translate-x-1"
							>
								<Icon name="arrowRight" class="size-4" />
							</span>
						{/if}
					</a>
					{#if category.description}
						<p class="mt-4 text-sm text-stone-600">{category.description}</p>
					{/if}
					{#if category.subcategories.length > 0}
						<ul class="mt-6 flex flex-wrap gap-2 text-sm">
							{#each category.subcategories as sub (sub.id)}
								<li>
									<a
										href="{catalogPath}?categoria={category.slug}&subcategoria={sub.slug}"
										class="inline-flex min-h-9 items-center rounded-full bg-white px-4 text-stone-700 transition-colors duration-200 hover:bg-stone-900 hover:text-white"
										>{sub.name}</a
									>
								</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
