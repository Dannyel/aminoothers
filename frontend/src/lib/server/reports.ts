import type {
	CategorySalesReport,
	InventoryValuation,
	SalesReport,
	TopProductsReport
} from '#lib/api/types.ts';

export const REPORT_VIEWS = ['ventas', 'productos', 'categorias', 'inventario'] as const;
export type ReportView = (typeof REPORT_VIEWS)[number];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Hoy en Guatemala (AAAA-MM-DD). */
export const guatemalaToday = (now = new Date()) =>
	new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(now);

/** Vista y rango pedidos en la URL; por defecto, el mes en curso. */
export function reportParams(url: URL, now = new Date()) {
	const today = guatemalaToday(now);
	const view = REPORT_VIEWS.find((v) => v === url.searchParams.get('vista')) ?? 'ventas';
	const from = url.searchParams.get('from') ?? '';
	const to = url.searchParams.get('to') ?? '';
	return {
		view,
		from: DATE.test(from) ? from : `${today.slice(0, 8)}01`,
		to: DATE.test(to) ? to : today
	};
}

export type ReportData =
	| { view: 'ventas'; report: SalesReport }
	| { view: 'productos'; report: TopProductsReport }
	| { view: 'categorias'; report: CategorySalesReport }
	| { view: 'inventario'; report: InventoryValuation };

/** Pide el reporte a la API con la sesión del usuario. */
export async function fetchReport(
	api: App.Locals['api'],
	params: { view: ReportView; from: string; to: string },
	limit = 50
): Promise<ReportData> {
	const range = `from=${params.from}&to=${params.to}`;
	switch (params.view) {
		case 'ventas':
			return {
				view: 'ventas',
				report: await api.request<SalesReport>(`/admin/reports/sales?${range}`)
			};
		case 'productos':
			return {
				view: 'productos',
				report: await api.request<TopProductsReport>(
					`/admin/reports/top-products?${range}&limit=${limit}`
				)
			};
		case 'categorias':
			return {
				view: 'categorias',
				report: await api.request<CategorySalesReport>(`/admin/reports/categories?${range}`)
			};
		case 'inventario':
			return {
				view: 'inventario',
				report: await api.request<InventoryValuation>('/admin/reports/inventory-valuation')
			};
	}
}

/**
 * Celda CSV: entre comillas si hace falta y sin fórmulas (un texto que empieza
 * con = + - @ se ejecutaría al abrirlo en una hoja de cálculo).
 */
export function csvCell(value: string | number | null | undefined): string {
	if (value === null || value === undefined) return '';
	if (typeof value === 'number') return String(value);
	const safe = /^[=+\-@\t\r]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value) ? `'${value}` : value;
	return /[",\n\r;]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(rows: Array<Array<string | number | null>>): string {
	// BOM para que Excel reconozca UTF-8 (tildes y ñ).
	return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** Filas del CSV de cada reporte, con encabezados en español. */
export function reportCsv(data: ReportData): string {
	switch (data.view) {
		case 'ventas':
			return toCsv([
				['Fecha', 'Pedidos', 'Unidades', 'Subtotal', 'Descuentos', 'Envío', 'IVA', 'Total'],
				...data.report.days.map((d) => [
					d.date,
					d.orders,
					d.units,
					d.subtotal,
					d.discount,
					d.shipping,
					d.tax,
					d.total
				]),
				[
					'Total',
					data.report.totals.orders,
					data.report.totals.units,
					data.report.totals.subtotal,
					data.report.totals.discount,
					data.report.totals.shipping,
					data.report.totals.tax,
					data.report.totals.total
				]
			]);
		case 'productos':
			return toCsv([
				['SKU', 'Producto', 'Unidades', 'Descuentos', 'Total vendido'],
				...data.report.rows.map((r) => [r.sku, r.name, r.units, r.discount, r.revenue])
			]);
		case 'categorias':
			return toCsv([
				['Categoría', 'Unidades', 'Total vendido', '% del total'],
				...data.report.rows.map((r) => [r.name, r.units, r.revenue, r.share])
			]);
		case 'inventario':
			return toCsv([
				['SKU', 'Producto', 'Unidades', 'No vendibles', 'Valor al costo'],
				...data.report.rows.map((r) => [r.sku, r.name, r.units, r.unsellableUnits, r.value]),
				['', 'Total', data.report.totalUnits, null, data.report.totalValue]
			]);
	}
}
