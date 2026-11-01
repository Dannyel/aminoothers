import type { Handle } from '@sveltejs/kit/hooks';
import { API_URL } from '$app/env/private';
import { createApiClient } from '#lib/server/api.ts';
import { resolveSession } from '#lib/server/session.ts';

export const handle: Handle = async ({ event, resolve }) => {
	// La API aplica el rate limiting y registra sesiones por la IP del cliente,
	// no por la de este servidor.
	const forwarded = {
		'X-Forwarded-For': event.getClientAddress(),
		'User-Agent': event.request.headers.get('user-agent') ?? 'desconocido'
	};
	const anonymous = createApiClient(API_URL, event.fetch, { headers: forwarded });
	const session = await resolveSession(event.cookies, anonymous);

	event.locals.user = session?.user ?? null;
	event.locals.accessToken = session?.accessToken;
	event.locals.api = session
		? createApiClient(API_URL, event.fetch, { headers: forwarded, token: session.accessToken })
		: anonymous;

	const response = await resolve(event);
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set(
		'Permissions-Policy',
		'camera=(), microphone=(), geolocation=(), payment=()'
	);
	return response;
};
