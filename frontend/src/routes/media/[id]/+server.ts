import { error } from '@sveltejs/kit';
import { API_URL } from '$app/env/private';
import { API_PREFIX } from '#lib/server/api.ts';
import type { RequestHandler } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FORWARDED_HEADERS = ['content-type', 'content-length', 'cache-control', 'etag'];

/**
 * Imágenes públicas (productos, categorías) servidas desde este dominio: el
 * navegador nunca habla directamente con la API.
 */
export const GET: RequestHandler = async ({ params, fetch, request }) => {
	if (!UUID.test(params.id)) error(404, 'No encontrado');
	const upstream = await fetch(`${API_URL}${API_PREFIX}/files/${params.id}`, {
		headers: request.headers.has('if-none-match')
			? { 'If-None-Match': request.headers.get('if-none-match')! }
			: {}
	});
	if (upstream.status === 304) return new Response(null, { status: 304 });
	if (!upstream.ok || !upstream.body) error(upstream.status === 404 ? 404 : 502, 'No disponible');

	const headers = new Headers({ 'X-Content-Type-Options': 'nosniff' });
	for (const name of FORWARDED_HEADERS) {
		const value = upstream.headers.get(name);
		if (value) headers.set(name, value);
	}
	return new Response(upstream.body, { headers });
};
