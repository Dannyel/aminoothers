<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ProductForm from '#lib/components/admin/ProductForm.svelte';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ConfirmButton from '#lib/components/ui/ConfirmButton.svelte';
	import { can, formatDateTime, formatMoney, SALE_CONDITION_LABELS } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const product = $derived(data.product);
	const canManage = $derived(can(data.staff, 'products.manage'));
	const canApprove = $derived(can(data.staff, 'products.approve_online_sale'));

	/** Orden resultante de mover una imagen una posición. */
	function moved(index: number, delta: number): string {
		const ids = product.images.map((i) => i.id);
		const target = index + delta;
		[ids[index], ids[target]] = [ids[target], ids[index]];
		return ids.join(',');
	}
</script>

<PageHeading title={product.name} description="{product.sku} · {formatMoney(product.price)}">
	{#snippet actions()}
		<a
			href={resolve('admin/productos')}
			class="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-200">← Volver</a
		>
	{/snippet}
</PageHeading>

<div class="grid gap-6 lg:grid-cols-[1fr_320px]">
	<div class="flex min-w-0 flex-col gap-4">
		{#if data.created}<Alert variant="success" messages="Producto creado." />{/if}
		<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
		<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />

		<ProductForm
			options={data.options}
			{product}
			action="?/update"
			submitLabel="Guardar cambios"
			disabled={!canManage}
		/>

		{#if canManage}
			<form method="post" action="?/remove" use:enhance>
				<ConfirmButton
					message="¿Dar de baja «{product.name}»? Dejará de mostrarse; los pedidos existentes conservan sus datos."
					confirmLabel="Dar de baja"
				>
					Dar de baja el producto
				</ConfirmButton>
			</form>
		{/if}
	</div>

	<aside class="flex flex-col gap-4">
		<section class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5">
			<h2 class="font-medium text-slate-900">Venta en línea</h2>
			<div class="flex flex-wrap gap-1">
				<Badge tone={product.onlineSale.enabled ? 'success' : 'neutral'}>
					{product.onlineSale.enabled ? 'Habilitada' : 'No habilitada'}
				</Badge>
				<Badge tone={product.saleCondition === 'OTC' ? 'info' : 'warning'}>
					{SALE_CONDITION_LABELS[product.saleCondition]}
				</Badge>
				{#if !product.isActive}<Badge>Inactivo</Badge>{/if}
			</div>
			{#if product.onlineSale.enabled}
				<p class="text-sm text-slate-600">
					Aprobada por {product.onlineSale.approvedBy?.name ?? '—'} el
					{formatDateTime(product.onlineSale.approvedAt)}.
				</p>
			{/if}
			{#if canApprove}
				{#if product.onlineSale.enabled}
					<form method="post" action="?/onlineSale" use:enhance>
						<input type="hidden" name="enabled" value="false" />
						<Button type="submit" variant="secondary">Deshabilitar venta en línea</Button>
					</form>
				{:else if product.saleCondition === 'OTC' && product.isActive}
					<form method="post" action="?/onlineSale" use:enhance>
						<input type="hidden" name="enabled" value="true" />
						<ConfirmButton
							variant="primary"
							message="Confirme que verificó que la venta en línea de este producto es legal y cumple los requisitos aplicables (registro sanitario, condición de venta). Quedará registrado a su nombre."
							confirmLabel="Habilitar"
						>
							Habilitar venta en línea
						</ConfirmButton>
					</form>
				{:else}
					<p class="text-sm text-slate-600">
						Solo los productos activos de venta libre pueden habilitarse en esta versión.
					</p>
				{/if}
			{/if}
		</section>

		<section class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5">
			<h2 class="font-medium text-slate-900">Imágenes</h2>
			{#if product.images.length === 0}
				<p class="text-sm text-slate-500">Sin imágenes.</p>
			{:else}
				<ul class="flex flex-col gap-3">
					{#each product.images as image, index (image.id)}
						<li class="flex gap-3">
							<img
								src={resolve(`media/${image.fileId}`)}
								alt={image.altText ?? product.name}
								class="size-20 rounded border border-slate-200 object-cover"
							/>
							<div class="flex flex-col gap-1 text-sm">
								{#if image.isPrimary}<Badge tone="info">Principal</Badge>{/if}
								{#if canManage}
									<div class="flex flex-wrap gap-1">
										{#if !image.isPrimary}
											<form method="post" action="?/setPrimary" use:enhance>
												<input type="hidden" name="imageId" value={image.id} />
												<button class="text-teal-700 hover:underline">Hacer principal</button>
											</form>
										{/if}
										{#if index > 0}
											<form method="post" action="?/moveImage" use:enhance>
												<input type="hidden" name="order" value={moved(index, -1)} />
												<button class="text-slate-600 hover:underline" aria-label="Subir">↑</button>
											</form>
										{/if}
										{#if index < product.images.length - 1}
											<form method="post" action="?/moveImage" use:enhance>
												<input type="hidden" name="order" value={moved(index, 1)} />
												<button class="text-slate-600 hover:underline" aria-label="Bajar">↓</button>
											</form>
										{/if}
									</div>
									<form method="post" action="?/removeImage" use:enhance>
										<input type="hidden" name="imageId" value={image.id} />
										<ConfirmButton
											message="¿Eliminar esta imagen?"
											confirmLabel="Eliminar"
											variant="secondary"
										>
											Eliminar
										</ConfirmButton>
									</form>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
			{#if canManage}
				<form
					method="post"
					action="?/addImage"
					enctype="multipart/form-data"
					class="flex flex-col gap-2 border-t border-slate-100 pt-3"
					use:enhance
				>
					<input
						type="file"
						name="file"
						accept="image/jpeg,image/png,image/webp"
						required
						class="text-sm"
					/>
					<input
						name="altText"
						maxlength={200}
						placeholder="Descripción de la imagen (opcional)"
						class="rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600"
					/>
					<div><Button type="submit" variant="secondary">Subir imagen</Button></div>
					<p class="text-xs text-slate-500">JPEG, PNG o WebP. Hasta 8 imágenes.</p>
				</form>
			{/if}
		</section>
	</aside>
</div>
