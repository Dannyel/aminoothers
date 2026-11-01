import type { ReturnRecord } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError, optionalText, text } from '#lib/server/forms.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requirePermission(locals, 'orders.read');
	try {
		return {
			ret: await locals.api.request<ReturnRecord>(`/admin/returns/${encodeURIComponent(params.id)}`)
		};
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

const opts = { loginPath: ADMIN_LOGIN };
const path = (id: string, action: string) => `/admin/returns/${encodeURIComponent(id)}/${action}`;

async function post(locals: App.Locals, url: string, body: object, success: string) {
	try {
		await locals.api.request(url, { method: 'POST', body });
		return { success };
	} catch (err) {
		return failFromApi(err, undefined, opts);
	}
}

export const actions: Actions = {
	approve: ({ locals, params }) =>
		post(locals, path(params.id, 'approve'), {}, 'Devolución aprobada.'),
	reject: async ({ request, locals, params }) =>
		post(
			locals,
			path(params.id, 'reject'),
			{ reason: text(await request.formData(), 'reason') },
			'Devolución rechazada.'
		),
	receive: ({ locals, params }) =>
		post(
			locals,
			path(params.id, 'receive'),
			{},
			'Unidades recibidas: quedan pendientes de inspección.'
		),
	inspect: async ({ request, locals, params }) => {
		const data = await request.formData();
		return post(
			locals,
			path(params.id, `items/${encodeURIComponent(text(data, 'itemId'))}/inspect`),
			{
				disposition: text(data, 'disposition'),
				conditionNotes: optionalText(data, 'conditionNotes')
			},
			'Inspección registrada.'
		);
	}
};
