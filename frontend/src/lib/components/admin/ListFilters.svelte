<script lang="ts">
	import { USER_STATUS_LABELS } from '#lib/utils/labels.ts';

	/** Búsqueda y filtro de estado por GET: la URL refleja los filtros y se puede compartir. */
	let {
		search,
		status,
		placeholder = 'Buscar por nombre o correo'
	}: { search: string; status: string; placeholder?: string } = $props();
</script>

<form method="get" class="mb-4 flex flex-wrap items-end gap-3" role="search">
	<label class="flex min-w-60 flex-1 flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Buscar</span>
		<input
			type="search"
			name="search"
			value={search}
			{placeholder}
			maxlength={100}
			class="rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600"
		/>
	</label>
	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium text-slate-700">Estado</span>
		<select
			name="status"
			value={status}
			class="rounded-md border-slate-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600"
		>
			<option value="">Todos</option>
			{#each Object.entries(USER_STATUS_LABELS) as [value, label] (value)}
				<option {value}>{label}</option>
			{/each}
		</select>
	</label>
	<button
		class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
		>Filtrar</button
	>
</form>
