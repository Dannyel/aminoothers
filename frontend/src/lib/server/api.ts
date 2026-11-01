// Cliente HTTP del backend. Solo se ejecuta en el servidor de SvelteKit (BFF):
// el navegador nunca habla directamente con la API ni ve sus tokens.

export const API_PREFIX = '/api/v1';
const DEFAULT_TIMEOUT_MS = 10_000;

export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly body: unknown,
		message: string
	) {
		super(message);
		this.name = 'ApiError';
	}
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
	/** Se serializa como JSON, salvo FormData (multipart, p. ej. imágenes). */
	body?: unknown;
	/** Access token del usuario; se envía como Bearer. */
	token?: string;
	timeoutMs?: number;
}

export interface ApiClient {
	request<T>(path: string, options?: ApiRequestOptions): Promise<T>;
}

/**
 * Crea un cliente ligado a un `fetch` concreto. En load/actions se debe pasar
 * `event.fetch` para conservar el contexto de la petición. `defaults` se envía
 * en todas las peticiones (IP y navegador del cliente, token de la sesión).
 */
export function createApiClient(
	baseUrl: string,
	fetchFn: typeof fetch,
	defaults: { headers?: HeadersInit; token?: string } = {}
): ApiClient {
	return {
		async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
			const {
				body,
				token = defaults.token,
				timeoutMs = DEFAULT_TIMEOUT_MS,
				headers,
				...init
			} = options;
			const requestHeaders = new Headers(defaults.headers);
			new Headers(headers).forEach((value, key) => requestHeaders.set(key, value));
			requestHeaders.set('Accept', 'application/json');
			const isMultipart = body instanceof FormData;
			// En multipart, fetch arma el Content-Type con su separador (boundary).
			if (body !== undefined && !isMultipart) {
				requestHeaders.set('Content-Type', 'application/json');
			}
			if (token) requestHeaders.set('Authorization', `Bearer ${token}`);

			const response = await fetchFn(`${baseUrl}${API_PREFIX}${path}`, {
				...init,
				headers: requestHeaders,
				body: body === undefined ? undefined : isMultipart ? body : JSON.stringify(body),
				signal: init.signal ?? AbortSignal.timeout(timeoutMs)
			});

			const text = await response.text();
			let data: unknown = undefined;
			if (text) {
				try {
					data = JSON.parse(text);
				} catch {
					data = text;
				}
			}

			if (!response.ok) {
				throw new ApiError(response.status, data, errorMessage(data, response.status));
			}
			return data as T;
		}
	};
}

function errorMessage(data: unknown, status: number): string {
	if (data && typeof data === 'object' && 'message' in data) {
		const message = (data as { message: unknown }).message;
		if (Array.isArray(message)) return message.join('; ');
		if (typeof message === 'string') return message;
	}
	return `La API respondió con estado ${status}`;
}
