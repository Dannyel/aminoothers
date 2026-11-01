import { requirePending, verifyMfaAction } from '#lib/server/auth-actions.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	requirePending(event, 'store');
};

export const actions: Actions = {
	default: (event) => verifyMfaAction(event, 'store')
};
