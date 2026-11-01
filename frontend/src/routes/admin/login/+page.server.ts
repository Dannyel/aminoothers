import { redirect } from '@sveltejs/kit';
import { loginAction } from '#lib/server/auth-actions.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user?.type === 'STAFF') redirect(303, '/admin');
};

export const actions: Actions = {
	default: (event) => loginAction(event, 'admin')
};
