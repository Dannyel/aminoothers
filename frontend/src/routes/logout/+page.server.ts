import { redirect } from '@sveltejs/kit';
import { clearSession } from '#lib/server/session.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => redirect(303, '/');

export const actions: Actions = {
	default: async ({ locals, cookies }) => {
		const isStaff = locals.user?.type === 'STAFF';
		if (locals.user) {
			// Si la API falla, igual se cierra la sesión local; el token vence solo.
			await locals.api.request('/auth/logout', { method: 'POST' }).catch(() => undefined);
		}
		clearSession(cookies);
		redirect(303, isStaff ? '/admin/login' : '/');
	}
};
