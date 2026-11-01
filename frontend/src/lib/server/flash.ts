// Mensaje de un solo uso que sobrevive a una redirección (p. ej. "Producto
// agregado al carrito" al volver a la página del producto). Vive en una cookie
// httpOnly de un minuto y se borra al leerlo.
import type { Cookies } from '@sveltejs/kit';

const FLASH_COOKIE = 'fx_flash';

export interface Flash {
	type: 'success' | 'error';
	message: string;
}

export function setFlash(cookies: Cookies, flash: Flash): void {
	cookies.set(FLASH_COOKIE, JSON.stringify(flash), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60
	});
}

export function takeFlash(cookies: Cookies): Flash | null {
	const raw = cookies.get(FLASH_COOKIE);
	if (!raw) return null;
	cookies.delete(FLASH_COOKIE, { path: '/' });
	try {
		const flash = JSON.parse(raw) as Partial<Flash>;
		return (flash.type === 'success' || flash.type === 'error') && typeof flash.message === 'string'
			? { type: flash.type, message: flash.message.slice(0, 300) }
			: null;
	} catch {
		return null;
	}
}
