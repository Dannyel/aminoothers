import { error, redirect } from '@sveltejs/kit';
import { ADMIN_LOGIN } from '#lib/server/admin.ts';
import { loadError } from '#lib/server/forms.ts';
import { fetchReport, reportCsv, reportParams } from '#lib/server/reports.ts';
import { can } from '#lib/utils/labels.ts';
import type { RequestHandler } from './$types';

/** Descarga el reporte en CSV (mismos datos y permisos que la página). */
export const GET: RequestHandler = async ({ locals, url }) => {
	if (locals.user?.type !== 'STAFF') redirect(303, ADMIN_LOGIN);
	if (!can(locals.user, 'reports.read')) error(403, 'No tiene permiso para ver reportes');
	const params = reportParams(url);
	try {
		const data = await fetchReport(locals.api, params, 200);
		const name =
			params.view === 'inventario'
				? `inventario-valorizado-${params.to}.csv`
				: `reporte-${params.view}-${params.from}-a-${params.to}.csv`;
		return new Response(reportCsv(data), {
			headers: {
				'Content-Type': 'text/csv; charset=utf-8',
				'Content-Disposition': `attachment; filename="${name}"`,
				'Cache-Control': 'private, no-store'
			}
		});
	} catch (err) {
		loadError(err, ADMIN_LOGIN);
	}
};
