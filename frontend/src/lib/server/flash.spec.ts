import type { Cookies } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { setFlash, takeFlash } from './flash.ts';

function fakeCookies(): Cookies {
	const jar = new Map<string, string>();
	return {
		get: (name: string) => jar.get(name),
		set: (name: string, value: string) => void jar.set(name, value),
		delete: (name: string) => void jar.delete(name)
	} as unknown as Cookies;
}

describe('flash', () => {
	it('se lee una sola vez', () => {
		const cookies = fakeCookies();
		setFlash(cookies, { type: 'success', message: 'Listo' });
		expect(takeFlash(cookies)).toEqual({ type: 'success', message: 'Listo' });
		expect(takeFlash(cookies)).toBeNull();
	});

	it('descarta contenido inválido', () => {
		const cookies = fakeCookies();
		cookies.set('fx_flash', '{"type":"html","message":"x"}', { path: '/' });
		expect(takeFlash(cookies)).toBeNull();
		cookies.set('fx_flash', 'no-json', { path: '/' });
		expect(takeFlash(cookies)).toBeNull();
	});
});
