import { redirect } from '@sveltejs/kit';
import { ADMIN_LOGIN } from '#lib/server/admin.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
	if (locals.user?.type !== 'STAFF') {
		redirect(303, `${ADMIN_LOGIN}?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
	}
	return { staff: locals.user };
};
