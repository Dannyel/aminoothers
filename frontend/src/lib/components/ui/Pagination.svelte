<script lang="ts">
	import { page as pageState } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import Icon from './Icon.svelte';

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

<nav
	class="flex flex-wrap items-center justify-between gap-4 text-sm text-stone-600"
	aria-label="Paginación"
>
	<p class="tabular-nums">{from}–{to} de {total}</p>
	<div class="flex items-center gap-2">
		{#if page > 1}
			<a
				class="inline-flex min-h-10 items-center gap-1 rounded-full border border-stone-300 bg-white px-4 font-medium text-stone-800 transition-colors duration-200 hover:border-stone-900"
				href={href(page - 1)}
				rel="prev"><Icon name="chevronLeft" class="size-4" />Anterior</a
			>
		{/if}
		<span class="px-2 tabular-nums" aria-current="page">Página {page} de {pages}</span>
		{#if page < pages}
			<a
				class="inline-flex min-h-10 items-center gap-1 rounded-full border border-stone-300 bg-white px-4 font-medium text-stone-800 transition-colors duration-200 hover:border-stone-900"
				href={href(page + 1)}
				rel="next">Siguiente<Icon name="chevronRight" class="size-4" /></a
			>
		{/if}
	</div>
</nav>
