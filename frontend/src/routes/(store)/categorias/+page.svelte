<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
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

<div class="mx-auto max-w-6xl px-4 py-8">
	<PageHeading title="Categorías" />
	{#if data.categories.length === 0}
		<EmptyState title="Aún no hay categorías" />
	{:else}
		<ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.categories as category (category.id)}
				<li class="rounded-lg border border-slate-200 bg-white p-5">
					<a
						href="{catalogPath}?categoria={category.slug}"
						class="text-lg font-medium text-teal-800 hover:underline">{category.name}</a
					>
					<p class="text-xs text-slate-500">{category.productCount} producto(s)</p>
					{#if category.description}
						<p class="mt-2 text-sm text-slate-600">{category.description}</p>
					{/if}
					{#if category.subcategories.length > 0}
						<ul class="mt-3 flex flex-wrap gap-2 text-sm">
							{#each category.subcategories as sub (sub.id)}
								<li>
									<a
										href="{catalogPath}?categoria={category.slug}&subcategoria={sub.slug}"
										class="rounded-full bg-slate-100 px-3 py-1 text-slate-700 hover:bg-teal-50 hover:text-teal-800"
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
