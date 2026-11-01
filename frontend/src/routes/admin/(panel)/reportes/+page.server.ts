import { ADMIN_LOGIN, requirePermission } from '#lib/server/admin.ts';
import { loadError } from '#lib/server/forms.ts';
import { fetchReport, reportParams } from '#lib/server/reports.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'reports.read');
	const params = reportParams(url);
	try {
		return { params, data: await fetchReport(locals.api, params) };
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};
