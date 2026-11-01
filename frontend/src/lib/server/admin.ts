import { error } from '@sveltejs/kit';
import { can } from '#lib/utils/labels.ts';
import { failFromApi } from './forms.ts';

export const ADMIN_LOGIN = '/admin/login';

/**
 * Verificación en el servidor del frontend para no mostrar páginas sin
 * permiso. La autorización real la hace siempre la API.
 */
export function requirePermission(locals: App.Locals, permission: string): void {
	if (!can(locals.user, permission)) error(403, 'No tiene permiso para ver esta página');
}

/** Restablece el doble factor de un usuario o cliente (`apiPath` sin /mfa-reset). */
export async function mfaResetAction(locals: App.Locals, apiPath: string) {
	try {
		await locals.api.request(`${apiPath}/mfa-reset`, { method: 'POST' });
		return { success: 'Doble factor restablecido. Deberá configurarlo de nuevo al ingresar.' };
	} catch (err) {
		return failFromApi(err, undefined, { loginPath: ADMIN_LOGIN });
	}
}
