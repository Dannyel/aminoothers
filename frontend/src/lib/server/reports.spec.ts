import { describe, expect, it } from 'vitest';
import { csvCell, reportParams, toCsv } from './reports.ts';

describe('reportes', () => {
	it('toma la vista y el rango de la URL o usa el mes en curso', () => {
		const now = new Date('2026-11-15T12:00:00Z');
		expect(reportParams(new URL('http://x/admin/reportes'), now)).toEqual({
			view: 'ventas',
			from: '2026-11-01',
			to: '2026-11-15'
		});
		expect(
			reportParams(new URL('http://x/?vista=categorias&from=2026-01-01&to=2026-01-31'), now)
		).toEqual({ view: 'categorias', from: '2026-01-01', to: '2026-01-31' });
		expect(reportParams(new URL('http://x/?vista=otra&from=ayer'), now)).toMatchObject({
			view: 'ventas',
			from: '2026-11-01'
		});
	});

	it('escapa comillas y separadores y neutraliza fórmulas', () => {
		expect(csvCell('Crema "suave", 50 ml')).toBe('"Crema ""suave"", 50 ml"');
		expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
		expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
		expect(csvCell('-12.50')).toBe('-12.50');
		expect(csvCell(3)).toBe('3');
		expect(csvCell(null)).toBe('');
	});

	it('genera CSV con BOM y fin de línea CRLF', () => {
		expect(toCsv([['a', 1]])).toBe('﻿a,1\r\n');
	});
});
