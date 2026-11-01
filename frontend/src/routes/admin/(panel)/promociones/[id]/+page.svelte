<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import PromotionForm from '#lib/components/admin/PromotionForm.svelte';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import ConfirmButton from '#lib/components/ui/ConfirmButton.svelte';
	import {
		can,
		formatDateTime,
		formatMoney,
		PROMOTION_STATE_LABELS,
		PROMOTION_STATE_TONES,
		promotionValue
	} from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const p = $derived(data.promotion);
	const canManage = $derived(can(data.staff, 'promotions.manage'));
</script>

<PageHeading
	title={p.name}
	description="{promotionValue(p.type, p.value)} · {formatDateTime(p.startsAt)} – {formatDateTime(
		p.endsAt
	)}"
>
	{#snippet actions()}
		<a
			href={resolve('admin/promociones')}
			class="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-200">← Volver</a
		>
	{/snippet}
</PageHeading>

<div class="flex max-w-4xl flex-col gap-4">
	<div><Badge tone={PROMOTION_STATE_TONES[p.state]}>{PROMOTION_STATE_LABELS[p.state]}</Badge></div>
	<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
	<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />
	{#if canManage}
		<PromotionForm promotion={p} products={data.products} action="?/update" submitLabel="Guardar" />
		<form method="post" action="?/remove" use:enhance>
			<ConfirmButton
				message="¿Dar de baja la promoción «{p.name}»? Los pedidos conservan el descuento aplicado."
				confirmLabel="Dar de baja"
			>
				Dar de baja
			</ConfirmButton>
		</form>
	{:else}
		<ul class="rounded-lg border border-slate-200 bg-white p-4 text-sm">
			{#each p.products as product (product.id)}
				<li>{product.name} · {product.sku} · {formatMoney(product.price)}</li>
			{/each}
		</ul>
	{/if}
</div>
