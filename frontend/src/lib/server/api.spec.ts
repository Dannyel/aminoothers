import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './api.ts';

function fakeFetch(status: number, body?: unknown) {
	return vi.fn<typeof fetch>(
		async () =>
			new Response(body === undefined ? null : JSON.stringify(body), {
				status,
				headers: { 'Content-Type': 'application/json' }
			})
	);
}

describe('createApiClient', () => {
	it('construye la URL con el prefijo /api/v1 y devuelve el JSON', async () => {
		const fetchFn = fakeFetch(200, { status: 'ok' });
		const api = createApiClient('http://api.local', fetchFn);

		await expect(api.request('/health')).resolves.toEqual({ status: 'ok' });
		expect(fetchFn).toHaveBeenCalledWith('http://api.local/api/v1/health', expect.any(Object));
	});

	it('envía el token como Bearer y serializa el cuerpo', async () => {
		const fetchFn = fakeFetch(201, { id: 1 });
		const api = createApiClient('http://api.local', fetchFn);

		await api.request('/items', { method: 'POST', body: { a: 1 }, token: 'abc' });

		const init = fetchFn.mock.calls[0][1]!;
		const headers = new Headers(init.headers);
		expect(headers.get('Authorization')).toBe('Bearer abc');
		expect(headers.get('Content-Type')).toBe('application/json');
		expect(init.body).toBe('{"a":1}');
	});

	it('no envía Content-Type ni Authorization si no hay cuerpo ni token', async () => {
		const fetchFn = fakeFetch(200, {});
		await createApiClient('http://api.local', fetchFn).request('/x');

		const headers = new Headers(fetchFn.mock.calls[0][1]!.headers);
		expect(headers.has('Content-Type')).toBe(false);
		expect(headers.has('Authorization')).toBe(false);
	});

	it('lanza ApiError con el estado y el mensaje de NestJS', async () => {
		const fetchFn = fakeFetch(400, { message: ['nombre es obligatorio', 'sku inválido'] });
		const api = createApiClient('http://api.local', fetchFn);

		const error = await api.request('/x').catch((e: unknown) => e);
		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).status).toBe(400);
		expect((error as ApiError).message).toBe('nombre es obligatorio; sku inválido');
	});

	it('acepta respuestas vacías', async () => {
		const api = createApiClient('http://api.local', fakeFetch(204));
		await expect(api.request('/x')).resolves.toBeUndefined();
	});

	it('aplica un tiempo de espera por defecto', async () => {
		const fetchFn = fakeFetch(200, {});
		await createApiClient('http://api.local', fetchFn).request('/x');
		expect(fetchFn.mock.calls[0][1]!.signal).toBeInstanceOf(AbortSignal);
	});
});

describe('createApiClient con FormData', () => {
	it('envía multipart sin forzar Content-Type JSON', async () => {
		const fetchFn = fakeFetch(201, {});
		const form = new FormData();
		form.append('file', new Blob(['x'], { type: 'image/png' }), 'a.png');
		await createApiClient('http://api.local', fetchFn).request('/x', {
			method: 'POST',
			body: form
		});

		const init = fetchFn.mock.calls[0][1]!;
		expect(init.body).toBe(form);
		expect(new Headers(init.headers).has('Content-Type')).toBe(false);
	});
});
