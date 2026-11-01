import { error, redirect } from '@sveltejs/kit';
import { API_URL } from '$app/env/private';
import { ADMIN_LOGIN } from '#lib/server/admin.ts';
import { API_PREFIX } from '#lib/server/api.ts';
import type { RequestHandler } from './$types';

/**
 * Comprobante privado de una transferencia. El navegador nunca recibe el token:
 * el BFF lo pide a la API con la sesión del usuario y reenvía el contenido.
 */
export const GET: RequestHandler = async ({ locals, params, fetch, getClientAddress }) => {
	if (locals.user?.type !== 'STAFF' || !locals.accessToken) redirect(303, ADMIN_LOGIN);
	const response = await fetch(
		`${API_URL}${API_PREFIX}/admin/payments/${encodeURIComponent(params.id)}/proof`,
		{
			headers: {
				Authorization: `Bearer ${locals.accessToken}`,
				// La consulta del comprobante se audita con la IP real del usuario.
				'X-Forwarded-For': getClientAddress()
			}
		}
	);
	if (response.status === 403) error(403, 'No tiene permiso para ver comprobantes');
	if (!response.ok) error(response.status === 404 ? 404 : 502, 'Comprobante no disponible');
	const type = response.headers.get('content-type') ?? 'application/octet-stream';
	// Las imágenes se muestran aisladas; los PDF se descargan (los visores de PDF
	// no funcionan dentro de una política sandbox).
	const isImage = type.startsWith('image/');
	return new Response(response.body, {
		headers: {
			'Content-Type': type,
			'Cache-Control': 'private, no-store',
			'Content-Disposition': isImage ? 'inline' : 'attachment; filename="comprobante.pdf"',
			'X-Content-Type-Options': 'nosniff',
			'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self'"
		}
	});
};
