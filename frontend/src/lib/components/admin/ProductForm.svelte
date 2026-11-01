<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { CatalogOption, ProductDetail, SaleCondition } from '#lib/api/types.ts';
	import type { ProductFormOptions } from '#lib/server/products.ts';
	import Alert from '#lib/components/ui/Alert.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import SelectField from '#lib/components/ui/SelectField.svelte';
	import TextField from '#lib/components/ui/TextField.svelte';
	import { SALE_CONDITION_LABELS } from '#lib/utils/labels.ts';

	let {
		options,
		product,
		messages,
		action,
		submitLabel,
		disabled = false
	}: {
		options: ProductFormOptions;
		product?: ProductDetail;
		messages?: string[];
		action?: string;
		submitLabel: string;
		disabled?: boolean;
	} = $props();

	const isNew = $derived(!product);
	// Valores iniciales editables: el formulario los cambia sin tocar la prop.
	let categoryId = $state(untrack(() => product?.category.id ?? ''));
	let saleCondition = $state<SaleCondition>(untrack(() => product?.saleCondition ?? 'OTC'));
	let submitting = $state(false);

	const subcategories = $derived(
		options.categories.find((c) => c.id === categoryId)?.subcategories.filter((s) => s.isActive) ??
			[]
	);
	const toOptions = (items: CatalogOption[]) => items.map((i) => ({ value: i.id, label: i.name }));
	const selectedIngredients = $derived(new Set(product?.activeIngredients.map((a) => a.id)));
	const selectedTags = $derived(new Set(product?.tags.map((t) => t.id)));
	const defaultTax = $derived(
		product?.taxRate.id ?? options.taxRates.find((r) => r.isDefault)?.id ?? ''
	);
	const saleConditionOptions = Object.entries(SALE_CONDITION_LABELS).map(([value, label]) => ({
		value,
		label
	}));
	const selectClass =
		'rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600';
</script>

<form
	method="post"
	{action}
	class="flex flex-col gap-6"
	use:enhance={() => {
		submitting = true;
		return async ({ update }) => {
			await update({ reset: false });
			submitting = false;
		};
	}}
>
	<Alert variant="error" {messages} />
	<fieldset
		class="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 sm:grid-cols-2"
		{disabled}
	>
		<legend class="px-1 font-medium text-slate-900">Identificación</legend>
		<TextField
			label="SKU"
			name="sku"
			required={isNew}
			readonly={!isNew}
			maxlength={50}
			value={product?.sku ?? ''}
			hint={isNew ? 'Letras, números, punto y guiones. No se puede cambiar después.' : undefined}
		/>
		<TextField
			label="Código de barras"
			name="barcode"
			maxlength={50}
			value={product?.barcode ?? ''}
		/>
		<div class="sm:col-span-2">
			<TextField
				label="Nombre comercial"
				name="name"
				required
				maxlength={200}
				value={product?.name ?? ''}
			/>
		</div>
		<div class="sm:col-span-2">
			<TextField
				label="Descripción corta"
				name="shortDescription"
				maxlength={300}
				value={product?.shortDescription ?? ''}
			/>
		</div>
		<label class="flex flex-col gap-1 text-sm sm:col-span-2">
			<span class="font-medium text-slate-700">Descripción completa</span>
			<textarea
				name="description"
				rows="5"
				maxlength={10000}
				class="rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600"
				>{product?.description ?? ''}</textarea
			>
		</label>
	</fieldset>

	<fieldset
		class="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 sm:grid-cols-2"
		{disabled}
	>
		<legend class="px-1 font-medium text-slate-900">Clasificación</legend>
		<SelectField
			label="Categoría"
			name="categoryId"
			required
			placeholder="Seleccione…"
			options={options.categories.map((c) => ({ value: c.id, label: c.name }))}
			bind:value={categoryId}
		/>
		<SelectField
			label="Subcategoría"
			name="subcategoryId"
			placeholder="Sin subcategoría"
			options={subcategories.map((s) => ({ value: s.id, label: s.name }))}
			value={product?.subcategory?.id ?? ''}
		/>
		<SelectField
			label="Marca"
			name="brandId"
			placeholder="Sin marca"
			options={toOptions(options.brands)}
			value={product?.brand?.id ?? ''}
		/>
		<SelectField
			label="Fabricante"
			name="manufacturerId"
			placeholder="Sin fabricante"
			options={toOptions(options.manufacturers)}
			value={product?.manufacturer?.id ?? ''}
		/>
		<SelectField
			label="Presentación"
			name="presentationId"
			placeholder="Sin presentación"
			options={toOptions(options.presentations)}
			value={product?.presentation?.id ?? ''}
		/>
		<SelectField
			label="Concentración"
			name="concentrationId"
			placeholder="Sin concentración"
			options={toOptions(options.concentrations)}
			value={product?.concentration?.id ?? ''}
		/>
		<label class="flex flex-col gap-1 text-sm">
			<span class="font-medium text-slate-700">Principios activos</span>
			<select name="activeIngredientIds" multiple size="5" class={selectClass}>
				{#each options.activeIngredients as item (item.id)}
					<option value={item.id} selected={selectedIngredients.has(item.id)}>{item.name}</option>
				{/each}
			</select>
			<span class="text-xs text-slate-500"
				>Ctrl/Cmd + clic para elegir varios. Vacío si no aplica.</span
			>
		</label>
		<label class="flex flex-col gap-1 text-sm">
			<span class="font-medium text-slate-700">Etiquetas</span>
			<select name="tagIds" multiple size="5" class={selectClass}>
				{#each options.tags as item (item.id)}
					<option value={item.id} selected={selectedTags.has(item.id)}>{item.name}</option>
				{/each}
			</select>
		</label>
	</fieldset>

	<fieldset
		class="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 sm:grid-cols-2"
		{disabled}
	>
		<legend class="px-1 font-medium text-slate-900">Información sanitaria</legend>
		<SelectField
			label="Condición de venta"
			name="saleCondition"
			required
			options={saleConditionOptions}
			bind:value={saleCondition}
		/>
		<div class="text-sm text-slate-600 sm:self-end">
			{#if saleCondition !== 'OTC'}
				No se vende en línea en esta versión; se muestra como «venta en farmacia».
			{/if}
		</div>
		<TextField
			label="Registro sanitario"
			name="sanitaryRegistration"
			maxlength={100}
			value={product?.sanitaryRegistration ?? ''}
		/>
		<TextField
			label="Vencimiento del registro"
			name="sanitaryRegistrationExpiresAt"
			type="date"
			value={product?.sanitaryRegistrationExpiresAt ?? ''}
		/>
	</fieldset>

	<fieldset
		class="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 sm:grid-cols-3"
		{disabled}
	>
		<legend class="px-1 font-medium text-slate-900">Precio e inventario</legend>
		<TextField
			label="Precio de venta (Q, IVA incluido)"
			name="price"
			required
			inputmode="decimal"
			value={product?.price ?? ''}
		/>
		<SelectField
			label="Impuesto"
			name="taxRateId"
			required
			options={options.taxRates.map((r) => ({ value: r.id, label: r.name }))}
			value={defaultTax}
		/>
		<TextField
			label="Alerta de existencias bajas"
			name="lowStockThreshold"
			type="number"
			min={0}
			value={String(product?.lowStockThreshold ?? 0)}
		/>
		<label class="flex items-center gap-2 text-sm text-slate-700">
			<input
				type="checkbox"
				name="isActive"
				checked={product?.isActive ?? true}
				class="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
			/>
			Producto activo
		</label>
	</fieldset>

	{#if !disabled}
		<div><Button type="submit" loading={submitting}>{submitLabel}</Button></div>
	{/if}
</form>
