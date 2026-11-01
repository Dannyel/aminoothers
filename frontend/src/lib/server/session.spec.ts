import type { Cookies } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import type { AuthTokens, Me } from '#lib/api/types.ts';
import { ApiError, type ApiClient } from './api.ts';
import {
	ACCESS_COOKIE,
	REFRESH_COOKIE,
	resolveSession,
	safeRedirectPath,
	saveSession
} from './session.ts';

const me = { id: 'u1', type: 'CUSTOMER', firstName: 'Ana' } as Me;

function fakeCookies(initial: Record<string, string> = {}) {
	const jar = new Map(Object.entries(initial));
	const cookies = {
		get: (name: string) => jar.get(name),
		set: vi.fn((name: string, value: string) => void jar.set(name, value)),
		delete: vi.fn((name: string) => void jar.delete(name))
	};
	return { cookies: cookies as unknown as Cookies, jar };
}

function fakeApi(handler: (path: string) => unknown): ApiClient {
	return {
		request: vi.fn(async (path: string) => {
			const result = handler(path);
			if (result instanceof Error) throw result;
			return result;
		})
	} as unknown as ApiClient;
}

const tokens: AuthTokens = {
	accessToken: 'nuevo-access',
	accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
	refreshToken: 'nuevo-refresh',
	refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
	user: me
};

describe('resolveSession', () => {
	it('sin cookies es anónimo y no llama a la API', async () => {
		const { cookies } = fakeCookies();
		const api = fakeApi(() => {
			throw new Error('no debería llamarse');
		});
		expect(await resolveSession(cookies, api)).toBeNull();
		expect(api.request).not.toHaveBeenCalled();
	});

	it('usa el access token vigente', async () => {
		const { cookies } = fakeCookies({ [ACCESS_COOKIE]: 'access' });
		const api = fakeApi((path) => (path === '/auth/me' ? me : undefined));
		expect(await resolveSession(cookies, api)).toEqual({ user: me, accessToken: 'access' });
	});

	it('renueva con el refresh token cuando el access token falta o venció', async () => {
		const { cookies, jar } = fakeCookies({
			[ACCESS_COOKIE]: 'vencido',
			[REFRESH_COOKIE]: 'refresh'
		});
		const api = fakeApi((path) =>
			path === '/auth/me' ? new ApiError(401, {}, 'vencido') : tokens
		);
		const session = await resolveSession(cookies, api);
		expect(session).toEqual({ user: me, accessToken: 'nuevo-access' });
		expect(jar.get(ACCESS_COOKIE)).toBe('nuevo-access');
		expect(jar.get(REFRESH_COOKIE)).toBe('nuevo-refresh');
	});

	it('borra las cookies si la API rechaza el refresh token', async () => {
		const { cookies, jar } = fakeCookies({ [REFRESH_COOKIE]: 'revocado' });
		const api = fakeApi(() => new ApiError(401, {}, 'revocado'));
		expect(await resolveSession(cookies, api)).toBeNull();
		expect(jar.size).toBe(0);
	});

	it('si la API no responde, sigue como anónimo sin borrar las cookies', async () => {
		const { cookies, jar } = fakeCookies({ [REFRESH_COOKIE]: 'refresh' });
		const api = fakeApi(() => new TypeError('fetch failed'));
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		expect(await resolveSession(cookies, api)).toBeNull();
		expect(jar.get(REFRESH_COOKIE)).toBe('refresh');
	});
});

describe('saveSession', () => {
	it('guarda los tokens en cookies httpOnly', () => {
		const { cookies } = fakeCookies();
		saveSession(cookies, tokens);
		expect(cookies.set).toHaveBeenCalledWith(
			ACCESS_COOKIE,
			'nuevo-access',
			expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' })
		);
	});
});

describe('safeRedirectPath', () => {
	it('acepta solo rutas internas', () => {
		expect(safeRedirectPath('/cuenta/perfil?x=1', '/')).toBe('/cuenta/perfil?x=1');
		expect(safeRedirectPath('https://malicioso.example', '/')).toBe('/');
		expect(safeRedirectPath('//malicioso.example', '/')).toBe('/');
		expect(safeRedirectPath('/\\malicioso.example', '/')).toBe('/');
		expect(safeRedirectPath(null, '/inicio')).toBe('/inicio');
	});
});
