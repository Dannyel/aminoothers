<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import {
		can,
		formatDateTime,
		formatOrderNumber,
		NOTIFICATION_STATUS_LABELS,
		NOTIFICATION_STATUS_TONES,
		NOTIFICATION_TYPE_LABELS
	} from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const n = $derived(data.notification);
</script>

<PageHeading title={n.previewSubject} description={NOTIFICATION_TYPE_LABELS[n.type]}>
	{#snippet actions()}
		<a
			href={resolve('admin/notificaciones')}
			class="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-200">Volver</a
		>
	{/snippet}
</PageHeading>

<div class="flex max-w-3xl flex-col gap-4">
	<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
	<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />

	<dl class="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 text-sm sm:grid-cols-2">
		<div>
			<dt class="text-slate-500">Destinatario</dt>
			<dd class="break-all">{n.recipient}</dd>
		</div>
		<div>
			<dt class="text-slate-500">Estado</dt>
			<dd>
				<Badge tone={NOTIFICATION_STATUS_TONES[n.status]}
					>{NOTIFICATION_STATUS_LABELS[n.status]}</Badge
				>
				<span class="text-slate-500">· {n.attempts} intento(s)</span>
			</dd>
		</div>
		<div>
			<dt class="text-slate-500">Encolado</dt>
			<dd>{formatDateTime(n.createdAt)}</dd>
		</div>
		<div>
			<dt class="text-slate-500">{n.sentAt ? 'Enviado' : 'Próximo intento'}</dt>
			<dd>{formatDateTime(n.sentAt ?? n.nextAttemptAt)}</dd>
		</div>
		{#if n.orderId && n.orderNumber && can(data.staff, 'orders.read')}
			<div>
				<dt class="text-slate-500">Pedido</dt>
				<dd>
					<a href={resolve(`admin/pedidos/${n.orderId}`)} class="text-teal-800 hover:underline"
						>{formatOrderNumber('PED', n.orderNumber)}</a
					>
				</dd>
			</div>
		{/if}
		{#if n.lastError}
			<div class="sm:col-span-2">
				<dt class="text-slate-500">Último error</dt>
				<dd class="font-mono text-xs break-all text-red-800">{n.lastError}</dd>
			</div>
		{/if}
	</dl>

	{#if n.status === 'FAILED'}
		<form method="post" action="?/retry" use:enhance>
			<Button type="submit">Reintentar envío</Button>
		</form>
	{/if}

	<section class="rounded-lg border border-slate-200 bg-white p-5">
		<h2 class="mb-2 text-sm font-medium text-slate-700">Contenido (texto)</h2>
		<pre class="text-sm whitespace-pre-wrap text-slate-800">{n.previewText}</pre>
	</section>
</div>
