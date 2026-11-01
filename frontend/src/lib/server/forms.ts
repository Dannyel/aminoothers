import { error, fail, redirect } from '@sveltejs/kit';
import { ApiError } from './api.ts';

/** Valor de texto de un formulario, recortado ('' si falta). */
export function text(data: FormData, name: string): string {
	const value = data.get(name);
	return typeof value === 'string' ? value.trim() : '';
}

/** Igual que `text`, pero undefined si está vacío (para campos opcionales). */
export function optionalText(data: FormData, name: string): string | undefined {
	return text(data, name) || undefined;
}

/** Contraseñas: no se recortan. */
export function secret(data: FormData, name: string): string {
	const value = data.get(name);
	return typeof value === 'string' ? value : '';
}

/** Mensajes de error de la API (NestJS devuelve string o string[]). */
export function apiMessages(err: ApiError): string[] {
	const body = err.body as { message?: unknown } | undefined;
	if (Array.isArray(body?.message)) return body.message.map(String);
	if (typeof body?.message === 'string') return [body.message];
	return [err.message];
}

/**
 * Convierte un error de la API en la respuesta de una form action. Una sesión
 * vencida lleva a `loginPath`; con `loginPath: null` (formularios de inicio de
 * sesión) el 401 se muestra como cualquier otro error.
 */
export function failFromApi<T extends Record<string, unknown>>(
	err: unknown,
	values?: T,
	{ loginPath = '/login' }: { loginPath?: string | null } = {}
) {
	if (!(err instanceof ApiError)) throw err;
	if (err.status === 401 && loginPath) redirect(303, loginPath);
	if (err.status >= 500) {
		return fail(502, { messages: ['El servicio no está disponible. Intente de nuevo.'], values });
	}
	return fail(err.status, { messages: apiMessages(err), values });
}

/** En un load: traduce errores de la API a la página de error de SvelteKit. */
export function loadError(err: unknown, loginPath = '/login'): never {
	if (!(err instanceof ApiError)) throw err;
	if (err.status === 401) redirect(303, loginPath);
	if (err.status === 403) error(403, 'No tiene permiso para ver esta página');
	if (err.status === 404) error(404, 'No encontrado');
	if (err.status === 400) error(400, apiMessages(err).join('; '));
	error(502, 'El servicio no está disponible. Intente de nuevo.');
}
