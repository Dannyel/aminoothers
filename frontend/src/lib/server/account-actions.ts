// Seguridad de la cuenta (contraseña, doble factor, sesiones), compartida por
// clientes y personal.
import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import type { Message, MfaStatus, RecoveryCodes } from '#lib/api/types.ts';
import { failFromApi, loadError, secret, text } from './forms.ts';
import { clearSession } from './session.ts';

/** Estado del doble factor para la página de seguridad. */
export async function loadSecurity(event: RequestEvent, loginPath: string) {
	try {
		return { mfa: await event.locals.api.request<MfaStatus>('/auth/mfa') };
	} catch (err) {
		loadError(err, loginPath);
	}
}

export async function changePasswordAction(event: RequestEvent, loginPath: string) {
	const data = await event.request.formData();
	const newPassword = secret(data, 'newPassword');
	if (newPassword !== secret(data, 'newPasswordConfirm')) {
		return fail(400, { section: 'password', messages: ['Las contraseñas nuevas no coinciden.'] });
	}
	try {
		const result = await event.locals.api.request<Message>('/auth/change-password', {
			method: 'POST',
			body: { currentPassword: secret(data, 'currentPassword'), newPassword }
		});
		return { section: 'password', success: result.message };
	} catch (err) {
		return withSection('password', failFromApi(err, undefined, { loginPath }));
	}
}

/** Reemplaza los códigos de recuperación; exige un código vigente de la app. */
export async function regenerateRecoveryCodesAction(event: RequestEvent, loginPath: string) {
	const code = text(await event.request.formData(), 'code').replace(/\s/g, '');
	try {
		const result = await event.locals.api.request<RecoveryCodes>('/auth/mfa/recovery-codes', {
			method: 'POST',
			body: { code }
		});
		return { section: 'mfa', recoveryCodes: result.recoveryCodes };
	} catch (err) {
		return withSection('mfa', failFromApi(err, undefined, { loginPath }));
	}
}

/** Cierra la sesión en todos los dispositivos, incluido este. */
export async function logoutAllAction(event: RequestEvent, loginPath: string) {
	await event.locals.api.request('/auth/logout-all', { method: 'POST' }).catch(() => undefined);
	clearSession(event.cookies);
	redirect(303, loginPath);
}

/** Indica a qué formulario de la página pertenece el error. */
function withSection(section: string, failure: ReturnType<typeof failFromApi>) {
	return fail(failure.status, { ...failure.data, section });
}
