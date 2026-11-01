import {
	changePasswordAction,
	loadSecurity,
	logoutAllAction,
	regenerateRecoveryCodesAction
} from '#lib/server/account-actions.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => loadSecurity(event, '/login');

export const actions: Actions = {
	changePassword: (event) => changePasswordAction(event, '/login'),
	regenerateCodes: (event) => regenerateRecoveryCodesAction(event, '/login'),
	logoutAll: (event) => logoutAllAction(event, '/login')
};
