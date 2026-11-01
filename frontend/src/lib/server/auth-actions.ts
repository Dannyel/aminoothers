// Inicio de sesión en dos pasos (contraseña + doble factor), compartido por la
// tienda y el panel.
import { fail, redirect, type Cookies, type RequestEvent } from '@sveltejs/kit';
import QRCode from 'qrcode';
import type {
	AuthTokens,
	AuthTokensWithRecovery,
	MfaChallenge,
	MfaEnrollment
} from '#lib/api/types.ts';
import { ApiError } from './api.ts';
import { failFromApi, secret, text } from './forms.ts';
import { ACCESS_COOKIE, safeRedirectPath, saveSession } from './session.ts';

export type Portal = 'store' | 'admin';

const MFA_COOKIE = 'fx_mfa';

interface PendingLogin {
	token: string;
	portal: Portal;
	redirectTo: string;
}

export const PORTAL_PATHS = {
	store: { login: '/login', home: '/cuenta/perfil' },
	admin: { login: '/admin/login', home: '/admin' }
} as const;

function readPending(cookies: Cookies, portal: Portal): PendingLogin | null {
	try {
		const pending = JSON.parse(cookies.get(MFA_COOKIE) ?? 'null') as PendingLogin | null;
		return pending?.portal === portal && typeof pending.token === 'string' ? pending : null;
	} catch {
		return null;
	}
}

function clearPending(cookies: Cookies): void {
	cookies.delete(MFA_COOKIE, { path: '/' });
}

/** El desafío venció o se agotaron los intentos: se vuelve a pedir la contraseña. */
function isExpired(err: unknown): boolean {
	return err instanceof ApiError && err.status === 401 && /Inicie sesión/.test(err.message);
}

/** Paso 1: contraseña. Guarda el desafío en una cookie httpOnly de 5 minutos. */
export async function loginAction(event: RequestEvent, portal: Portal) {
	const data = await event.request.formData();
	const email = text(data, 'email');
	const password = secret(data, 'password');
	if (!email || !password) {
		return fail(400, { messages: ['Ingrese su correo y contraseña.'], values: { email } });
	}

	let challenge: MfaChallenge;
	try {
		challenge = await event.locals.api.request<MfaChallenge>(`/auth/${portal}/login`, {
			method: 'POST',
			body: { email, password }
		});
	} catch (err) {
		return failFromApi(err, { email }, { loginPath: null });
	}

	const paths = PORTAL_PATHS[portal];
	const pending: PendingLogin = {
		token: challenge.mfaToken,
		portal,
		redirectTo: safeRedirectPath(event.url.searchParams.get('redirectTo'), paths.home)
	};
	event.cookies.set(MFA_COOKIE, JSON.stringify(pending), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		expires: new Date(challenge.expiresAt)
	});
	redirect(
		303,
		`${paths.login}/${challenge.enrollmentRequired ? 'configurar-doble-factor' : 'verificacion'}`
	);
}

/** Paso 2: requiere un desafío pendiente; si no lo hay, vuelve al inicio de sesión. */
export function requirePending(event: RequestEvent, portal: Portal): PendingLogin {
	const pending = readPending(event.cookies, portal);
	if (!pending) redirect(303, PORTAL_PATHS[portal].login);
	return pending;
}

export async function verifyMfaAction(event: RequestEvent, portal: Portal) {
	const pending = requirePending(event, portal);
	const data = await event.request.formData();
	const useRecovery = text(data, 'method') === 'recovery';
	const body = useRecovery
		? { mfaToken: pending.token, recoveryCode: text(data, 'recoveryCode') }
		: { mfaToken: pending.token, code: text(data, 'code').replace(/\s/g, '') };

	let tokens: AuthTokens;
	try {
		tokens = await event.locals.api.request<AuthTokens>('/auth/mfa/verify', {
			method: 'POST',
			body
		});
	} catch (err) {
		if (isExpired(err)) {
			clearPending(event.cookies);
			return fail(401, { expired: true, messages: [(err as ApiError).message] });
		}
		return failFromApi(err, { useRecovery }, { loginPath: null });
	}
	clearPending(event.cookies);
	saveSession(event.cookies, tokens);
	redirect(303, pending.redirectTo);
}

/** Datos para configurar la app autenticadora: secreto y código QR (SVG). */
export async function loadEnrollment(event: RequestEvent, portal: Portal) {
	const pending = readPending(event.cookies, portal);
	// Configuración recién terminada (incluso en el mismo POST, sin JavaScript):
	// la página muestra los códigos de recuperación.
	if (!pending && (event.locals.user || event.cookies.get(ACCESS_COOKIE))) {
		return { enrollment: null };
	}
	if (!pending) redirect(303, PORTAL_PATHS[portal].login);

	try {
		const enrollment = await event.locals.api.request<MfaEnrollment>('/auth/mfa/enroll', {
			method: 'POST',
			body: { mfaToken: pending.token }
		});
		const qrSvg = await QRCode.toString(enrollment.otpauthUri, {
			type: 'svg',
			margin: 1,
			errorCorrectionLevel: 'M'
		});
		return { enrollment: { secret: enrollment.secret, qrSvg } };
	} catch (err) {
		if (err instanceof ApiError && (err.status === 401 || err.status === 400)) {
			clearPending(event.cookies);
			redirect(303, PORTAL_PATHS[portal].login);
		}
		throw err;
	}
}

export async function confirmEnrollmentAction(event: RequestEvent, portal: Portal) {
	const pending = requirePending(event, portal);
	const code = text(await event.request.formData(), 'code').replace(/\s/g, '');

	let result: AuthTokensWithRecovery;
	try {
		result = await event.locals.api.request<AuthTokensWithRecovery>('/auth/mfa/enroll/confirm', {
			method: 'POST',
			body: { mfaToken: pending.token, code }
		});
	} catch (err) {
		if (isExpired(err)) {
			clearPending(event.cookies);
			return fail(401, { expired: true, messages: [(err as ApiError).message] });
		}
		return failFromApi(err, undefined, { loginPath: null });
	}
	clearPending(event.cookies);
	saveSession(event.cookies, result);
	return { recoveryCodes: result.recoveryCodes, next: pending.redirectTo };
}
