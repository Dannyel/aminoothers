<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import OrderTotals from '#lib/components/store/OrderTotals.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { formatMoney } from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const cart = $derived(data.cart);
	let busy = $state(false);

	const submitting = () => {
		busy = true;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			busy = false;
		};
	};
	/** Opciones de cantidad: hasta lo disponible, sin ocultar la cantidad actual. */
	const options = (max: number, current: number) =>
		Array.from({ length: Math.max(max, current, 1) }, (_, i) => i + 1);
</script>

<svelte:head>
	<title>Carrito · {data.info.tradeName}</title>
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-8">
	<PageHeading title="Carrito" />
	<div class="mb-4 flex flex-col gap-2">
		{#if data.flash}<Alert variant={data.flash.type} messages={data.flash.message} />{/if}
		<Alert variant="error" messages={form?.messages} />
	</div>

	{#if cart.lines.length === 0}
		<EmptyState title="Su carrito está vacío">
			<a href={resolve('productos')} class="text-teal-800 hover:underline">Ver el catálogo</a>
		</EmptyState>
	{:else}
		<div class="grid gap-6 lg:grid-cols-[1fr_320px]">
			<ul class="flex flex-col gap-3" aria-busy={busy}>
				{#each cart.lines as line (line.productId)}
					<li
						class="flex gap-4 rounded-lg border bg-white p-4 {line.issue
							? 'border-amber-300'
							: 'border-slate-200'}"
					>
						<div class="flex size-20 shrink-0 items-center justify-center rounded-md bg-slate-100">
							{#if line.imageFileId}
								<img src="/media/{line.imageFileId}" alt="" class="size-full object-contain" />
							{/if}
						</div>
						<div class="flex min-w-0 flex-1 flex-col gap-2">
							<div class="flex flex-wrap justify-between gap-2">
								<div>
									<a
										href={resolve(`productos/${line.slug}`)}
										class="font-medium text-slate-900 hover:underline">{line.name}</a
									>
									<p class="text-xs text-slate-500">
										{[line.presentation, line.concentration].filter(Boolean).join(' · ')}
									</p>
									<p class="text-sm text-slate-600">
										{#if Number(line.unitDiscount) > 0}
											<span class="text-red-700"
												>{formatMoney(Number(line.unitPrice) - Number(line.unitDiscount))} c/u</span
											>
											<s class="text-slate-400">{formatMoney(line.unitPrice)}</s>
											<span class="text-xs text-red-700">· {line.promotionName}</span>
										{:else}
											{formatMoney(line.unitPrice)} c/u
										{/if}
									</p>
								</div>
								<p class="font-semibold">{formatMoney(line.lineTotal)}</p>
							</div>
							{#if line.issue}
								<p class="text-sm text-amber-800" role="alert">{line.issue}</p>
							{/if}
							<div class="flex flex-wrap items-center gap-3">
								{#if line.maxQuantity > 0}
									<form
										method="post"
										action="?/update"
										class="flex items-center gap-2"
										use:enhance={submitting}
									>
										<input type="hidden" name="productId" value={line.productId} />
										<label for="qty-{line.productId}" class="text-sm text-slate-600">Cantidad</label
										>
										<select
											id="qty-{line.productId}"
											name="quantity"
											value={line.quantity}
											onchange={(e) => e.currentTarget.form?.requestSubmit()}
											class="rounded-md border-slate-300 text-sm focus:border-teal-600 focus:ring-teal-600"
										>
											{#each options(line.maxQuantity, line.quantity) as n (n)}
												<option value={n} disabled={n > line.maxQuantity}>{n}</option>
											{/each}
										</select>
										<noscript
											><Button type="submit" variant="secondary">Actualizar</Button></noscript
										>
									</form>
								{/if}
								<form method="post" action="?/remove" use:enhance={submitting}>
									<input type="hidden" name="productId" value={line.productId} />
									<button class="text-sm text-red-700 hover:underline">Quitar</button>
								</form>
							</div>
						</div>
					</li>
				{/each}
			</ul>

			<aside class="flex h-fit flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5">
				<h2 class="font-semibold text-slate-900">Resumen</h2>
				<OrderTotals {...cart.summary} />
				{#if cart.canCheckout}
					<a
						href={resolve('checkout')}
						class="rounded-md bg-teal-700 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-teal-800"
						>Continuar con la compra</a
					>
				{:else}
					<p class="text-sm text-amber-800">
						Corrija o quite los productos marcados para continuar.
					</p>
				{/if}
				<p class="text-xs text-slate-500">
					Los precios y la disponibilidad se confirman al realizar el pedido.
				</p>
			</aside>
		</div>
	{/if}
</div>
