import { fail } from '@sveltejs/kit';
import type { StoreSettings } from '#lib/api/types.ts';
import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { failFromApi, loadError, text } from '#lib/server/forms.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'settings.manage');
	try {
		return { settings: await locals.api.request<StoreSettings>('/admin/settings/store') };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};

const opts = { loginPath: ADMIN_LOGIN };
const OPTIONAL = [
	'legalName',
	'taxId',
	'fiscalAddress',
	'phone',
	'whatsapp',
	'email',
	'staffAlertEmail',
	'businessHours',
	'sanitaryLicense',
	'regentName'
] as const;
const NUMBERS = [
	'transferReservationHours',
	'codReservationHours',
	'maxUnitsPerProduct',
	'returnWindowDays'
] as const;

export const actions: Actions = {
	update: async ({ request, locals }) => {
		const data = await request.formData();
		const body: Record<string, string | number | null> = {
			tradeName: text(data, 'tradeName'),
			regulatoryNotice: text(data, 'regulatoryNotice')
		};
		for (const name of OPTIONAL) body[name] = text(data, name) || null;
		for (const name of NUMBERS) body[name] = Number(text(data, name));
		if (typeof body.taxId === 'string') body.taxId = body.taxId.replace(/[\s-]/g, '').toUpperCase();
		try {
			await locals.api.request('/admin/settings/store', { method: 'PATCH', body });
			return { success: 'Configuración guardada.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},

	logo: async ({ request, locals }) => {
		const file = (await request.formData()).get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { messages: ['Seleccione una imagen.'] });
		}
		const body = new FormData();
		body.append('file', file, file.name);
		try {
			await locals.api.request('/admin/settings/store/logo', { method: 'PUT', body });
			return { success: 'Logotipo actualizado.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	},

	removeLogo: async ({ locals }) => {
		try {
			await locals.api.request('/admin/settings/store/logo', { method: 'DELETE' });
			return { success: 'Logotipo eliminado.' };
		} catch (err) {
			return failFromApi(err, undefined, opts);
		}
	}
};
