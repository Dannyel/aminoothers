<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ConfirmButton from '#lib/components/ui/ConfirmButton.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';
	import { can } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const category = $derived(data.category);
	const canManage = $derived(can(data.staff, 'catalog.manage'));
	const keep =
		() =>
		async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
			update({ reset: false });
</script>

<PageHeading title={category.name} description="{category.productCount} producto(s)">
	{#snippet actions()}
		<a
			href={resolve('admin/categorias')}
			class="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-200">← Volver</a
		>
	{/snippet}
</PageHeading>

<div class="flex max-w-3xl flex-col gap-6">
	<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
	<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />

	<form
		method="post"
		action="?/update"
		class="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 sm:grid-cols-2"
		use:enhance={keep}
	>
		<TextField
			label="Nombre"
			name="name"
			required
			maxlength={100}
			value={category.name}
			disabled={!canManage}
		/>
		<TextField
			label="Orden"
			name="sortOrder"
			type="number"
			min={0}
			max={10000}
			value={String(category.sortOrder)}
			disabled={!canManage}
		/>
		<div class="sm:col-span-2">
			<TextField
				label="Descripción"
				name="description"
				maxlength={500}
				value={category.description ?? ''}
				disabled={!canManage}
			/>
		</div>
		<label class="flex items-center gap-2 text-sm text-slate-700">
			<input
				type="checkbox"
				name="isActive"
				checked={category.isActive}
				disabled={!canManage}
				class="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
			/>
			Activa
		</label>
		{#if canManage}<div class="sm:col-span-2"><Button type="submit">Guardar</Button></div>{/if}
	</form>

	<section class="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
		<h2 class="font-medium text-slate-900">Imagen</h2>
		{#if category.imageFileId}
			<img
				src={resolve(`media/${category.imageFileId}`)}
				alt={category.name}
				class="h-32 w-32 rounded-md border border-slate-200 object-cover"
			/>
		{:else}
			<p class="text-sm text-slate-500">Sin imagen.</p>
		{/if}
		{#if canManage}
			<form
				method="post"
				action="?/image"
				enctype="multipart/form-data"
				class="flex flex-wrap items-center gap-3"
				use:enhance
			>
				<input
					type="file"
					name="file"
					accept="image/jpeg,image/png,image/webp"
					required
					class="text-sm"
				/>
				<Button type="submit" variant="secondary">Subir</Button>
			</form>
			{#if category.imageFileId}
				<form method="post" action="?/removeImage" use:enhance>
					<Button type="submit" variant="ghost">Quitar imagen</Button>
				</form>
			{/if}
		{/if}
	</section>

	<section class="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
		<h2 class="font-medium text-slate-900">Subcategorías</h2>
		{#if canManage}
			<form method="post" action="?/createSub" class="flex flex-wrap items-end gap-3" use:enhance>
				<div class="min-w-60 flex-1">
					<TextField label="Nueva subcategoría" name="name" required maxlength={100} />
				</div>
				<Button type="submit">Agregar</Button>
			</form>
		{/if}
		{#if category.subcategories.length === 0}
			<p class="text-sm text-slate-500">Sin subcategorías.</p>
		{:else}
			<ul class="divide-y divide-slate-100">
				{#each category.subcategories as sub (sub.id)}
					<li class="flex flex-wrap items-center gap-3 py-2">
						<span class="flex-1 text-sm text-slate-800">
							{sub.name}
							{#if !sub.isActive}<Badge>Inactiva</Badge>{/if}
							<span class="text-xs text-slate-500">· {sub.productCount} producto(s)</span>
						</span>
						{#if canManage}
							<form method="post" action="?/updateSub" use:enhance>
								<input type="hidden" name="id" value={sub.id} />
								<input type="hidden" name="isActive" value={String(!sub.isActive)} />
								<Button type="submit" variant="ghost"
									>{sub.isActive ? 'Desactivar' : 'Activar'}</Button
								>
							</form>
							{#if sub.productCount === 0}
								<form method="post" action="?/removeSub" use:enhance>
									<input type="hidden" name="id" value={sub.id} />
									<ConfirmButton
										message="¿Eliminar la subcategoría «{sub.name}»?"
										confirmLabel="Eliminar"
									>
										Eliminar
									</ConfirmButton>
								</form>
							{/if}
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	{#if canManage && category.productCount === 0}
		<form method="post" action="?/remove" use:enhance>
			<ConfirmButton
				message="¿Eliminar la categoría «{category.name}» y sus subcategorías?"
				confirmLabel="Eliminar"
			>
				Eliminar categoría
			</ConfirmButton>
		</form>
	{/if}
</div>
