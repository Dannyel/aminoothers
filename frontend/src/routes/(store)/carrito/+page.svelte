<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import CheckoutSteps from '#lib/components/store/CheckoutSteps.svelte';
	import OrderTotals from '#lib/components/store/OrderTotals.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
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
	const units = $derived(cart.lines.reduce((sum, line) => sum + line.quantity, 0));
</script>

<svelte:head>
	<title>Carrito · {data.info.tradeName}</title>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
	{#if cart.lines.length > 0}<CheckoutSteps current={0} />{/if}

	<header class="mb-8 flex flex-wrap items-baseline justify-between gap-4">
		<h1 class="text-4xl sm:text-5xl">Carrito</h1>
		{#if cart.lines.length > 0}
			<p class="text-stone-500">
				<span class="tabular-nums">{units}</span>
				{units === 1 ? 'unidad' : 'unidades'}
			</p>
		{/if}
	</header>

	<div class="mb-6 flex flex-col gap-2 empty:hidden">
		{#if data.flash}<Alert variant={data.flash.type} messages={data.flash.message} />{/if}
		<Alert variant="error" messages={form?.messages} />
	</div>

	{#if cart.lines.length === 0}
		<EmptyState title="Su carrito está vacío" icon="bag">
			Descubra el catálogo y agregue lo que necesite.
			<div class="mt-6">
				<a href={resolve('productos')} class="btn btn-primary">Explorar productos</a>
			</div>
		</EmptyState>
	{:else}
		<div class="grid gap-10 lg:grid-cols-[1fr_22rem] lg:gap-14">
			<ul class="flex flex-col border-t border-stone-200" aria-busy={busy}>
				{#each cart.lines as line (line.productId)}
					<li class="flex gap-4 border-b border-stone-200 py-6 sm:gap-6">
						<a
							href={resolve(`productos/${line.slug}`)}
							class="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-sunken sm:size-32"
							tabindex="-1"
							aria-hidden="true"
						>
							{#if line.imageFileId}
								<img
									src="/media/{line.imageFileId}"
									alt=""
									class="size-full object-contain p-3 mix-blend-multiply"
								/>
							{:else}
								<Icon name="image" class="size-6 text-stone-400" strokeWidth={1.25} />
							{/if}
						</a>
						<div class="flex min-w-0 flex-1 flex-col gap-3">
							<div class="flex flex-wrap justify-between gap-x-4 gap-y-1">
								<div class="min-w-0">
									<a
										href={resolve(`productos/${line.slug}`)}
										class="font-medium text-stone-950 underline-offset-4 hover:underline"
										>{line.name}</a
									>
									<p class="text-sm text-stone-500">
										{[line.presentation, line.concentration].filter(Boolean).join(' · ')}
									</p>
									<p class="mt-1 text-sm text-stone-600 tabular-nums">
										{#if Number(line.unitDiscount) > 0}
											<span class="text-accent-700"
												>{formatMoney(Number(line.unitPrice) - Number(line.unitDiscount))} c/u</span
											>
											<s class="text-stone-400">{formatMoney(line.unitPrice)}</s>
											<span class="text-xs text-accent-800">· {line.promotionName}</span>
										{:else}
											{formatMoney(line.unitPrice)} c/u
										{/if}
									</p>
								</div>
								<p class="font-medium text-stone-950 tabular-nums">
									{formatMoney(line.lineTotal)}
								</p>
							</div>
							{#if line.issue}
								<p
									class="flex items-start gap-2 rounded-xl bg-accent-50 px-3 py-2 text-sm text-accent-800"
									role="alert"
								>
									<Icon name="alert" class="mt-0.5 size-4" />{line.issue}
								</p>
							{/if}
							<div class="mt-auto flex flex-wrap items-center gap-4">
								{#if line.maxQuantity > 0}
									<form
										method="post"
										action="?/update"
										class="flex items-center gap-2"
										use:enhance={submitting}
									>
										<input type="hidden" name="productId" value={line.productId} />
										<label for="qty-{line.productId}" class="sr-only">Cantidad</label>
										<select
											id="qty-{line.productId}"
											name="quantity"
											value={line.quantity}
											onchange={(e) => e.currentTarget.form?.requestSubmit()}
											class="min-h-10 rounded-full! py-1.5 pr-9 pl-4 text-sm"
										>
											{#each options(line.maxQuantity, line.quantity) as n (n)}
												<option value={n} disabled={n > line.maxQuantity}>{n}</option>
											{/each}
										</select>
										<noscript
											><Button type="submit" variant="secondary" size="sm">Actualizar</Button
											></noscript
										>
									</form>
								{/if}
								<form method="post" action="?/remove" use:enhance={submitting}>
									<input type="hidden" name="productId" value={line.productId} />
									<button
										class="min-h-10 text-sm text-stone-500 underline-offset-4 transition-colors duration-200 hover:text-red-700 hover:underline"
										>Quitar<span class="sr-only"> {line.name}</span></button
									>
								</form>
							</div>
						</div>
					</li>
				{/each}
			</ul>

			<aside class="lg:sticky lg:top-36 lg:self-start">
				<div class="rounded-3xl bg-white p-6 ring-1 ring-stone-200 sm:p-7">
					<h2 class="mb-6 text-xl">Resumen</h2>
					<OrderTotals {...cart.summary} />
					{#if cart.canCheckout}
						<a href={resolve('checkout')} class="btn btn-primary mt-7 min-h-12 w-full"
							>Continuar con la compra <Icon name="arrowRight" class="size-4" /></a
						>
					{:else}
						<p class="mt-6 rounded-xl bg-accent-50 px-4 py-3 text-sm text-accent-800">
							Corrija o quite los productos marcados para continuar.
						</p>
					{/if}
					<p class="mt-4 flex items-center justify-center gap-1.5 text-xs text-stone-500">
						<Icon name="lock" class="size-3.5" /> Precios y disponibilidad se confirman al pedir
					</p>
				</div>
				<a href={resolve('productos')} class="link mt-5 block text-center text-sm"
					>Seguir comprando</a
				>
			</aside>
		</div>
	{/if}
</div>
