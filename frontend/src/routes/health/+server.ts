import { json } from '@sveltejs/kit';
import { API_URL } from '$app/env/private';
import { createApiClient } from '#lib/server/api.ts';
import type { components } from '#lib/api/schema.ts';
import type { RequestHandler } from './$types';

type ApiHealth = components['schemas']['HealthResponseDto'];

/** Chequeo de salud del frontend y de su conexión con la API y la base de datos. */
export const GET: RequestHandler = async ({ fetch }) => {
	const api = createApiClient(API_URL, fetch);
	try {
		const health = await api.request<ApiHealth>('/health', { timeoutMs: 3_000 });
		return json({ status: 'ok', api: 'up', database: health.database });
	} catch {
		return json({ status: 'error', api: 'down' }, { status: 503 });
	}
};
