<script lang="ts" module>
	/*
	 * Íconos de línea de Lucide (https://lucide.dev, licencia ISC), copiados como trazos SVG
	 * para no agregar una dependencia. Son decorativos por defecto (aria-hidden); si un ícono
	 * es lo único que tiene un botón o enlace, el texto accesible va en ese elemento.
	 */
	const PATHS = {
		search: ['M21 21l-4.34-4.34', 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z'],
		cart: [
			'M8 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
			'M19 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
			'M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12'
		],
		user: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'],
		package: [
			'M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z',
			'M12 22V12',
			'M3.29 7 12 12l8.71-5',
			'm7.5 4.27 9 5.15'
		],
		logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
		menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
		close: ['M18 6 6 18', 'm6 6 12 12'],
		shield: [
			'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
			'm9 12 2 2 4-4'
		],
		truck: [
			'M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2',
			'M15 18H9',
			'M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14',
			'M17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
			'M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'
		],
		banknote: [
			'M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
			'M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
			'M6 12h.01M18 12h.01'
		],
		pill: ['m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z', 'm8.5 8.5 7 7'],
		check: ['M20 6 9 17l-5-5'],
		checkCircle: ['M21.8 10A10 10 0 1 1 17 3.34', 'm9 11 3 3L22 4'],
		info: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 16v-4', 'M12 8h.01'],
		alert: [
			'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3',
			'M12 9v4',
			'M12 17h.01'
		],
		alertCircle: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 8v4', 'M12 16h.01'],
		chevronLeft: ['m15 18-6-6 6-6'],
		chevronRight: ['m9 18 6-6-6-6'],
		arrowRight: ['M5 12h14', 'm12 5 7 7-7 7'],
		phone: [
			'M13.83 16.57a1 1 0 0 0 1.21-.3l.36-.47A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.47.35a1 1 0 0 0-.29 1.23 14 14 0 0 0 6.39 6.39'
		],
		mail: [
			'm22 7-8.99 5.73a2 2 0 0 1-2.02 0L2 7',
			'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'
		],
		clock: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 6v6l4 2'],
		mapPin: [
			'M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0',
			'M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'
		],
		message: ['M7.9 20A9 9 0 1 0 4 16.1L2 22Z'],
		image: [
			'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
			'M9 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
			'm21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21'
		],
		bag: [
			'M16 10a4 4 0 0 1-8 0',
			'M3.1 6h17.8',
			'M3.4 5.47A2 2 0 0 0 3 6.67V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.67a2 2 0 0 0-.4-1.2l-2-2.67A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z'
		],
		minus: ['M5 12h14'],
		plus: ['M5 12h14', 'M12 5v14'],
		sliders: [
			'M21 4h-7',
			'M10 4H3',
			'M21 12h-9',
			'M8 12H3',
			'M21 20h-5',
			'M12 20H3',
			'M14 2v4',
			'M8 10v4',
			'M16 18v4'
		],
		chevronDown: ['m6 9 6 6 6-6'],
		tag: [
			'M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z',
			'M7.5 7.5h.01'
		],
		refresh: [
			'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8',
			'M21 3v5h-5',
			'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16',
			'M8 16H3v5'
		],
		lock: [
			'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z',
			'M7 11V7a5 5 0 0 1 10 0v4'
		],
		grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
		inbox: [
			'M22 12h-6l-2 3h-4l-2-3H2',
			'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z'
		]
	} as const;

	export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
	let {
		name,
		class: className = 'size-5',
		strokeWidth = 2
	}: { name: IconName; class?: string; strokeWidth?: number } = $props();
</script>

<svg
	class="shrink-0 {className}"
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	{#each PATHS[name] as d (d)}<path {d} />{/each}
</svg>
