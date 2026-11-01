<script lang="ts">
	import { page as pageState } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';

	let {
		basePath,
		page,
		pageSize,
		total
	}: { basePath: string; page: number; pageSize: number; total: number } = $props();

	const pages = $derived(Math.max(1, Math.ceil(total / pageSize)));
	const from = $derived(total === 0 ? 0 : (page - 1) * pageSize + 1);
	const to = $derived(Math.min(total, page * pageSize));

	/** Conserva los filtros actuales de la URL y cambia solo la página. `basePath` llega resuelto. */
	function href(target: number) {
		const params = new SvelteURLSearchParams(pageState.url.search);
		params.set('page', String(target));
		return `${basePath}?${params}`;
	}
</script>

<!-- Los enlaces se arman sobre basePath, que llega resuelto con resolve(). -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->

<nav class="flex items-center justify-between gap-4 text-sm text-slate-600" aria-label="Paginación">
	<p>{from}–{to} de {total}</p>
	<div class="flex gap-2">
		{#if page > 1}
			<a
				class="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50"
				href={href(page - 1)}>Anterior</a
			>
		{/if}
		<span class="px-2 py-1">Página {page} de {pages}</span>
		{#if page < pages}
			<a
				class="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50"
				href={href(page + 1)}>Siguiente</a
			>
		{/if}
	</div>
</nav>
