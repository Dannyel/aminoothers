/** Catálogos simples: segmento de URL en español → recurso de la API. */
export const SIMPLE_CATALOGS = {
	marcas: { kind: 'brands', title: 'Marcas', singular: 'marca' },
	fabricantes: { kind: 'manufacturers', title: 'Fabricantes', singular: 'fabricante' },
	presentaciones: {
		kind: 'presentations',
		title: 'Presentaciones',
		singular: 'presentación',
		hint: 'Caja, blister, frasco, tableta, cápsula, unidad, tubo…'
	},
	concentraciones: {
		kind: 'concentrations',
		title: 'Concentraciones',
		singular: 'concentración',
		hint: 'Tal como se muestra al cliente: 500 mg, 10 ml, 5 %, 875 mg + 125 mg…'
	},
	'principios-activos': {
		kind: 'active-ingredients',
		title: 'Principios activos',
		singular: 'principio activo'
	},
	etiquetas: { kind: 'tags', title: 'Etiquetas', singular: 'etiqueta' }
} as const satisfies Record<
	string,
	{ kind: string; title: string; singular: string; hint?: string }
>;

export type SimpleCatalogSlug = keyof typeof SIMPLE_CATALOGS;

export function simpleCatalog(slug: string) {
	return Object.hasOwn(SIMPLE_CATALOGS, slug) ? SIMPLE_CATALOGS[slug as SimpleCatalogSlug] : null;
}
