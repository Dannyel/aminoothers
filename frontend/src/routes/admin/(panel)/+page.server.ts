import type { Dashboard } from '#lib/api/types.ts';
import { ADMIN_LOGIN } from '#lib/server/admin.ts';
import { loadError } from '#lib/server/forms.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		// Cada sección llega nula si el usuario no tiene el permiso correspondiente.
		return { dashboard: await locals.api.request<Dashboard>('/admin/dashboard') };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};
