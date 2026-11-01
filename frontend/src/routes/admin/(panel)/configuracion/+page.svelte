<script lang="ts">
	import { enhance } from '$app/forms';
	import PageHeading from '#lib/components/PageHeading.svelte';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const s = $derived(data.settings);
	const keep =
		() =>
		async ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) =>
			update({ reset: false });
	const box = 'grid gap-4 rounded-lg border border-slate-200 bg-white p-6 sm:grid-cols-2';
</script>

<PageHeading
	title="Configuración de la farmacia"
	description="Datos que muestra la tienda y parámetros de los pedidos."
/>

<div class="flex max-w-4xl flex-col gap-6">
	<Alert variant="success" messages={form && 'success' in form ? form.success : undefined} />
	<Alert variant="error" messages={form && 'messages' in form ? form.messages : undefined} />

	<section class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-6">
		<h2 class="font-semibold text-slate-900">Logotipo</h2>
		{#if s.logoFileId}
			<img src="/media/{s.logoFileId}" alt="Logotipo actual" class="h-16 w-auto self-start" />
		{:else}
			<p class="text-sm text-slate-500">Sin logotipo: la tienda muestra el nombre comercial.</p>
		{/if}
		<div class="flex flex-wrap items-end gap-3">
			<form
				method="post"
				action="?/logo"
				enctype="multipart/form-data"
				class="flex items-end gap-3"
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
			{#if s.logoFileId}
				<form method="post" action="?/removeLogo" use:enhance>
					<Button type="submit" variant="ghost">Quitar logotipo</Button>
				</form>
			{/if}
		</div>
	</section>

	<form method="post" action="?/update" class="flex flex-col gap-6" use:enhance={keep}>
		<section class={box}>
			<h2 class="font-semibold text-slate-900 sm:col-span-2">Datos de la farmacia</h2>
			<TextField
				label="Nombre comercial"
				name="tradeName"
				required
				maxlength={150}
				value={s.tradeName}
			/>
			<TextField label="Razón social" name="legalName" maxlength={200} value={s.legalName ?? ''} />
			<TextField label="NIT" name="taxId" maxlength={20} value={s.taxId ?? ''} />
			<TextField
				label="Dirección fiscal"
				name="fiscalAddress"
				maxlength={300}
				value={s.fiscalAddress ?? ''}
			/>
			<TextField label="Teléfono" name="phone" type="tel" maxlength={30} value={s.phone ?? ''} />
			<TextField
				label="WhatsApp"
				name="whatsapp"
				type="tel"
				maxlength={30}
				value={s.whatsapp ?? ''}
			/>
			<TextField
				label="Correo de contacto"
				name="email"
				type="email"
				maxlength={254}
				value={s.email ?? ''}
			/>
			<TextField
				label="Horario de atención"
				name="businessHours"
				maxlength={300}
				value={s.businessHours ?? ''}
			/>
		</section>

		<section class={box}>
			<h2 class="font-semibold text-slate-900 sm:col-span-2">Información regulatoria</h2>
			<p class="text-sm text-slate-600 sm:col-span-2">
				El texto exacto debe validarlo el regente farmacéutico con las disposiciones vigentes.
			</p>
			<TextField
				label="Licencia sanitaria del establecimiento"
				name="sanitaryLicense"
				maxlength={100}
				value={s.sanitaryLicense ?? ''}
			/>
			<TextField
				label="Regente farmacéutico"
				name="regentName"
				maxlength={150}
				value={s.regentName ?? ''}
			/>
			<label class="flex flex-col gap-1 text-sm sm:col-span-2">
				<span class="font-medium text-slate-700"
					>Leyenda en toda la tienda <span class="text-red-600" aria-hidden="true">*</span></span
				>
				<textarea
					name="regulatoryNotice"
					required
					rows="3"
					maxlength={2000}
					class="rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600"
					>{s.regulatoryNotice}</textarea
				>
			</label>
		</section>

		<section class={box}>
			<h2 class="font-semibold text-slate-900 sm:col-span-2">Pedidos</h2>
			<TextField
				label="Plazo para pagar por transferencia (horas)"
				name="transferReservationHours"
				type="number"
				min={1}
				max={168}
				required
				hint="Al vencer, el pedido se cancela y se liberan los productos."
				value={s.transferReservationHours}
			/>
			<TextField
				label="Plazo para confirmar contra entrega (horas)"
				name="codReservationHours"
				type="number"
				min={1}
				max={168}
				required
				value={s.codReservationHours}
			/>
			<TextField
				label="Máximo de unidades por producto en un pedido"
				name="maxUnitsPerProduct"
				type="number"
				min={1}
				max={100}
				required
				value={s.maxUnitsPerProduct}
			/>
			<TextField
				label="Plazo para registrar devoluciones (días desde la entrega)"
				name="returnWindowDays"
				type="number"
				min={0}
				max={90}
				required
				value={s.returnWindowDays}
			/>
		</section>

		<section class="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5">
			<h2 class="text-base font-semibold">Notificaciones</h2>
			<TextField
				label="Correo de alertas del personal"
				name="staffAlertEmail"
				type="email"
				maxlength={254}
				value={s.staffAlertEmail ?? ''}
				hint="Recibe los comprobantes de transferencia por verificar y el resumen diario de alertas de inventario. Déjelo vacío para no enviarlos."
			/>
		</section>

		<div><Button type="submit">Guardar configuración</Button></div>
	</form>
</div>
