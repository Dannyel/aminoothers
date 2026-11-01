<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';
	import { can } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<PageHeading title="Categorías" description="Organizan el catálogo de la tienda." />

<div class="flex flex-col gap-4">
	{#if can(data.staff, 'catalog.manage')}
		<form
			method="post"
			action="?/create"
			class="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
			use:enhance={() =>
				async ({ update }) =>
					update({ reset: false })}
		>
			<TextField
				label="Nueva categoría"
				name="name"
				required
				maxlength={100}
				value={form?.values?.name ?? ''}
			/>
			<TextField
				label="Descripción"
				name="description"
				maxlength={500}
				value={form?.values?.description ?? ''}
			/>
			<Button type="submit">Agregar</Button>
			<div class="sm:col-span-3"><Alert variant="error" messages={form?.messages} /></div>
		</form>
	{/if}

	{#if data.categories.length === 0}
		<EmptyState title="Aún no hay categorías" />
	{:else}
		<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.categories as category (category.id)}
				<li>
					<a
						href={resolve(`admin/categorias/${category.id}`)}
						class="flex h-full flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 hover:border-teal-600"
					>
						<span class="font-medium text-slate-900">
							{category.name}
							{#if !category.isActive}<Badge>Inactiva</Badge>{/if}
						</span>
						<span class="text-sm text-slate-500">
							{category.subcategories.length} subcategoría(s) · {category.productCount} producto(s)
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>
