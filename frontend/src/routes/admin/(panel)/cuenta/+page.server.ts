import {
	changePasswordAction,
	loadSecurity,
	logoutAllAction,
	regenerateRecoveryCodesAction
} from '#lib/server/account-actions.ts';
import { ADMIN_LOGIN } from '#lib/server/admin.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => loadSecurity(event, ADMIN_LOGIN);

export const actions: Actions = {
	changePassword: (event) => changePasswordAction(event, ADMIN_LOGIN),
	regenerateCodes: (event) => regenerateRecoveryCodesAction(event, ADMIN_LOGIN),
	logoutAll: (event) => logoutAllAction(event, ADMIN_LOGIN)
};
