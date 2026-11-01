import type { NotificationPreview } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError } from '#lib/server/forms.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals, 'notifications.manage');
	try {
		return {
			notification: await locals.api.request<NotificationPreview>(
				`/admin/notifications/${encodeURIComponent(params.id)}`
			)
		};
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

export const actions: Actions = {
	retry: async ({ locals, params }) => {
		try {
			await locals.api.request(`/admin/notifications/${encodeURIComponent(params.id)}/retry`, {
				method: 'POST'
			});
			return { success: 'El correo volvió a la cola; se enviará en el próximo ciclo.' };
		} catch (err) {
			return failFromApi(err, undefined, { loginPath: ADMIN_LOGIN });
		}
	}
};
