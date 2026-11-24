<script lang="ts">
	import { resolve } from '$app/paths';
	import ReceiptDocument from '#lib/components/ReceiptDocument.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Comprobante interno · {data.info.tradeName}</title>
</svelte:head>

<div class="mb-4 flex justify-between gap-2 print:hidden">
	<a
		href={resolve(`cuenta/pedidos/${data.invoice.orderId}`)}
		class="rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-stone-200">← Volver al pedido</a
	>
	<Button type="button" variant="secondary" onclick={() => window.print()}>Imprimir</Button>
</div>
<ReceiptDocument invoice={data.invoice} issuer={data.info.legalName ?? data.info.tradeName} />
