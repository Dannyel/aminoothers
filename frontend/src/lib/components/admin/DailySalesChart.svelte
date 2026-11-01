<script lang="ts">
	import { formatDate, formatMoney } from '#lib/utils/labels.ts';

	/** Ventas por día: una sola serie (la tarjeta la nombra; no lleva leyenda). */
	let { days }: { days: Array<{ date: string; orders: number; total: string }> } = $props();

	const W = 600;
	const H = 160;
	const GAP = 2;
	const max = $derived(Math.max(1, ...days.map((d) => Number(d.total))));
	const step = $derived(W / Math.max(1, days.length));
	let active = $state<number | null>(null);
	const current = $derived(active === null ? null : days[active]);

	/** Barra con extremo superior redondeado (4 px) apoyada en la línea base. */
	function barPath(i: number, value: number): string {
		const h = (value / max) * (H - 8);
		if (h <= 0) return '';
		const x = i * step + GAP / 2;
		const w = Math.max(1, step - GAP);
		const r = Math.min(4, w / 2, h);
		const y = H - h;
		return `M${x},${H} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${H} Z`;
	}
</script>

<div class="relative">
	<p class="mb-2 h-5 text-sm text-slate-600" aria-live="polite">
		{#if current}
			<span class="font-medium text-slate-900">{formatDate(current.date)}</span>:
			{formatMoney(current.total)} · {current.orders} pedido(s)
		{:else}
			Pase el cursor sobre una barra para ver el detalle del día.
		{/if}
	</p>
	<svg
		viewBox="0 0 {W} {H + 1}"
		class="h-40 w-full"
		preserveAspectRatio="none"
		role="img"
		aria-label="Ventas por día de los últimos {days.length} días"
	>
		<line x1="0" x2={W} y1={H + 0.5} y2={H + 0.5} class="stroke-slate-300" stroke-width="1" />
		{#each days as day, i (day.date)}
			<path
				d={barPath(i, Number(day.total))}
				class={active === i ? 'fill-teal-800' : 'fill-teal-600'}
			/>
			<!-- Zona de interacción más grande que la barra (toda la columna). -->
			<rect
				x={i * step}
				y="0"
				width={step}
				height={H}
				fill="transparent"
				role="presentation"
				onmouseenter={() => (active = i)}
				onmouseleave={() => (active = null)}
			/>
		{/each}
	</svg>
	<div class="mt-1 flex justify-between text-xs text-slate-500">
		<span>{formatDate(days[0]?.date)}</span>
		<span>{formatDate(days.at(-1)?.date)}</span>
	</div>
	<table class="sr-only">
		<caption>Ventas por día</caption>
		<thead><tr><th>Fecha</th><th>Pedidos</th><th>Total</th></tr></thead>
		<tbody>
			{#each days as day (day.date)}
				<tr
					><td>{formatDate(day.date)}</td><td>{day.orders}</td><td>{formatMoney(day.total)}</td></tr
				>
			{/each}
		</tbody>
	</table>
</div>
