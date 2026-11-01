// Sesión del usuario en el BFF: los tokens viven solo en cookies httpOnly de
// este dominio; el JavaScript del navegador nunca los ve.
import type { Cookies } from '@sveltejs/kit';
import type { AuthTokens, Me } from '#lib/api/types.ts';
import { ApiError, type ApiClient } from './api.ts';

export const ACCESS_COOKIE = 'fx_access';
export const REFRESH_COOKIE = 'fx_refresh';

/** Margen para renovar el access token antes de que venza. */
const ACCESS_EXPIRY_MARGIN_MS = 30_000;

export interface Session {
	user: Me;
	accessToken: string;
}

const cookieOptions = { path: '/', httpOnly: true, sameSite: 'lax' } as const;

export function saveSession(cookies: Cookies, tokens: AuthTokens): Session {
	const accessExpires = new Date(Date.parse(tokens.accessTokenExpiresAt) - ACCESS_EXPIRY_MARGIN_MS);
	cookies.set(ACCESS_COOKIE, tokens.accessToken, { ...cookieOptions, expires: accessExpires });
	cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
		...cookieOptions,
		expires: new Date(tokens.refreshTokenExpiresAt)
	});
	return { user: tokens.user, accessToken: tokens.accessToken };
}

export function clearSession(cookies: Cookies): void {
	cookies.delete(ACCESS_COOKIE, { path: '/' });
	cookies.delete(REFRESH_COOKIE, { path: '/' });
}

const isAuthError = (error: unknown) =>
	error instanceof ApiError && (error.status === 401 || error.status === 400);

/**
 * Obtiene la sesión de la petición. Usa el access token si sigue vigente; si
 * no, lo renueva con el refresh token. Si la API no responde, la petición
 * continúa como anónima sin borrar las cookies.
 */
export async function resolveSession(cookies: Cookies, api: ApiClient): Promise<Session | null> {
	const accessToken = cookies.get(ACCESS_COOKIE);
	const refreshToken = cookies.get(REFRESH_COOKIE);

	try {
		if (accessToken) {
			try {
				const user = await api.request<Me>('/auth/me', { token: accessToken });
				return { user, accessToken };
			} catch (error) {
				if (!isAuthError(error)) throw error;
			}
		}
		if (!refreshToken) {
			if (accessToken) clearSession(cookies);
			return null;
		}
		const tokens = await api.request<AuthTokens>('/auth/refresh', {
			method: 'POST',
			body: { refreshToken }
		});
		return saveSession(cookies, tokens);
	} catch (error) {
		if (isAuthError(error)) {
			clearSession(cookies);
			return null;
		}
		console.error('No se pudo validar la sesión con la API', error);
		return null;
	}
}

/** Solo rutas internas, para evitar redirecciones abiertas a otros sitios. */
export function safeRedirectPath(value: string | null, fallback: string): string {
	return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
		? value
		: fallback;
}
