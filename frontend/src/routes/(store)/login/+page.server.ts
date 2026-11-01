import { redirect } from '@sveltejs/kit';
import { loginAction } from '#lib/server/auth-actions.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user?.type === 'CUSTOMER') redirect(303, '/cuenta/perfil');
};

export const actions: Actions = {
	default: (event) => loginAction(event, 'store')
};
