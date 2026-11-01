<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import ReceiptDocument from '#lib/components/ReceiptDocument.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ConfirmButton from '#lib/components/ui/ConfirmButton.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';
	import {
		can,
		FEL_STATUS_LABELS,
		FEL_STATUS_TONES,
		formatOrderNumber
	} from '#lib/utils/labels.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const inv = $derived(data.invoice);
	const values = $derived(form && 'values' in form ? form.values : undefined);
	const canManage = $derived(can(data.staff, 'billing.manage'));
	const field =
		'rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600';
</script>

<PageHeading title="Comprobante {formatOrderNumber('CI', inv.number)}">
	{#snippet actions()}
		<a
			href={resolve(`admin/pedidos/${inv.orderId}`)}
			class="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-200 print:hidden"
			>Ver pedido</a
		>
		<Button type="button" variant="secondary" onclick={() => window.print()}>Imprimir</Button>
	{/snippet}
</PageHeading>

<div class="flex max-w-4xl flex-col gap-4">
	<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
	<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />
	<div class="print:hidden">
		<Badge tone={FEL_STATUS_TONES[inv.fel.status]}>{FEL_STATUS_LABELS[inv.fel.status]}</Badge>
	</div>

	<ReceiptDocument invoice={inv} issuer={data.info.legalName ?? data.info.tradeName} />

	{#if canManage && inv.status === 'ISSUED'}
		<section
			class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 text-sm print:hidden"
		>
			<h2 class="font-semibold text-slate-900">
				{inv.fel.status === 'CERTIFIED' ? 'Corregir datos de la FEL' : 'Registrar la FEL emitida'}
			</h2>
			<p class="text-slate-600">
				Emita la factura electrónica en el portal de su certificador con los datos de este
				comprobante y registre aquí lo que le devuelve.
			</p>
			<form method="post" action="?/fel" class="grid gap-3 sm:grid-cols-2" use:enhance>
				<TextField
					label="Número de autorización (UUID)"
					name="authorizationUuid"
					required
					value={values?.authorizationUuid ?? inv.fel.authorizationUuid ?? ''}
				/>
				<TextField
					label="Certificador"
					name="certifier"
					required
					maxlength={100}
					value={values?.certifier ?? inv.fel.certifier ?? ''}
				/>
				<TextField
					label="Serie"
					name="series"
					required
					maxlength={50}
					value={values?.series ?? inv.fel.series ?? ''}
				/>
				<TextField
					label="Número de DTE"
					name="number"
					required
					maxlength={50}
					pattern={'[0-9]{1,50}'}
					value={values?.number ?? inv.fel.number ?? ''}
				/>
				<TextField
					label="Fecha de certificación (hora de Guatemala)"
					name="certifiedAt"
					type="datetime-local"
					required
				/>
				<div class="flex items-end"><Button type="submit">Guardar datos FEL</Button></div>
			</form>
		</section>
		<section
			class="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-5 text-sm print:hidden"
		>
			<h2 class="font-semibold text-slate-900">Anular comprobante</h2>
			{#if inv.fel.status === 'CERTIFIED'}
				<p class="text-amber-800">
					La FEL registrada debe anularse también en el portal del certificador.
				</p>
			{/if}
			<form method="post" action="?/void" class="flex flex-wrap items-end gap-2" use:enhance>
				<input
					name="reason"
					required
					maxlength={500}
					placeholder="Motivo de la anulación"
					class="{field} flex-1"
				/>
				<ConfirmButton
					message="¿Anular el comprobante {formatOrderNumber('CI', inv.number)}?"
					confirmLabel="Anular">Anular</ConfirmButton
				>
			</form>
		</section>
	{/if}
</div>
