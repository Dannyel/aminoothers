import { confirmEnrollmentAction, loadEnrollment } from '#lib/server/auth-actions.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => loadEnrollment(event, 'admin');

export const actions: Actions = {
	default: (event) => confirmEnrollmentAction(event, 'admin')
};
