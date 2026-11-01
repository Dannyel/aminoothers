<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ConfirmButton from '#lib/components/ui/ConfirmButton.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';
	import { can } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const canManage = $derived(can(data.staff, 'catalog.manage'));
	let editingId = $state<string | null>(null);
	const keepValues =
		() =>
		async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => {
			await update({ reset: false });
			editingId = null;
		};
</script>

<PageHeading
	title={data.catalog.title}
	description={'hint' in data.catalog ? data.catalog.hint : undefined}
/>

<div class="flex flex-col gap-4">
	<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
	<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />

	{#if canManage}
		<form
			method="post"
			action="?/create"
			class="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
			use:enhance
		>
			<div class="min-w-60 flex-1">
				<TextField label="Agregar {data.catalog.singular}" name="name" required maxlength={150} />
			</div>
			<Button type="submit">Agregar</Button>
		</form>
	{/if}

	<form method="get" class="flex flex-wrap items-end gap-3" role="search">
		<label class="flex min-w-60 flex-1 flex-col gap-1 text-sm">
			<span class="font-medium text-slate-700">Buscar</span>
			<input
				type="search"
				name="search"
				value={data.search}
				maxlength={100}
				class="rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600"
			/>
		</label>
		<label class="flex flex-col gap-1 text-sm">
			<span class="font-medium text-slate-700">Estado</span>
			<select
				name="status"
				value={data.status}
				class="rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600"
			>
				<option value="active">Activos</option>
				<option value="inactive">Inactivos</option>
				<option value="all">Todos</option>
			</select>
		</label>
		<button
			class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
			>Filtrar</button
		>
	</form>

	{#if data.result.items.length === 0}
		<EmptyState title="No hay elementos que coincidan" />
	{:else}
		<ul class="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
			{#each data.result.items as item (item.id)}
				<li class="flex flex-wrap items-center gap-3 px-4 py-3">
					{#if editingId === item.id}
						<form
							method="post"
							action="?/update"
							class="flex flex-1 flex-wrap gap-2"
							use:enhance={keepValues}
						>
							<input type="hidden" name="id" value={item.id} />
							<input
								name="name"
								value={item.name}
								required
								maxlength={150}
								aria-label="Nombre"
								class="min-w-60 flex-1 rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600"
							/>
							<Button type="submit">Guardar</Button>
							<Button type="button" variant="ghost" onclick={() => (editingId = null)}
								>Cancelar</Button
							>
						</form>
					{:else}
						<div class="min-w-0 flex-1">
							<p class="font-medium text-slate-900">
								{item.name}
								{#if !item.isActive}<Badge>Inactivo</Badge>{/if}
							</p>
							<p class="text-xs text-slate-500">{item.productCount} producto(s)</p>
						</div>
						{#if canManage}
							<Button type="button" variant="ghost" onclick={() => (editingId = item.id)}
								>Editar</Button
							>
							<form method="post" action="?/update" use:enhance>
								<input type="hidden" name="id" value={item.id} />
								<input type="hidden" name="isActive" value={String(!item.isActive)} />
								<Button type="submit" variant="secondary"
									>{item.isActive ? 'Desactivar' : 'Activar'}</Button
								>
							</form>
							{#if item.productCount === 0}
								<form method="post" action="?/remove" use:enhance>
									<input type="hidden" name="id" value={item.id} />
									<ConfirmButton message="¿Eliminar «{item.name}»?" confirmLabel="Eliminar">
										Eliminar
									</ConfirmButton>
								</form>
							{/if}
						{/if}
					{/if}
				</li>
			{/each}
		</ul>
		<Pagination
			basePath={resolve(`admin/catalogos/${page.params.tipo}`)}
			page={data.result.page}
			pageSize={data.result.pageSize}
			total={data.result.total}
		/>
	{/if}
</div>
