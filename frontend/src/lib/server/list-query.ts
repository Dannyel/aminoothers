/** Lee page/search/status de la URL y arma la query para la API. */
export function listQuery(url: URL) {
	const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
	const search = (url.searchParams.get('search') ?? '').trim().slice(0, 100);
	const status = url.searchParams.get('status') ?? '';
	const params = new URLSearchParams({ page: String(page), pageSize: '20' });
	if (search) params.set('search', search);
	if (['ACTIVE', 'BLOCKED', 'INACTIVE'].includes(status)) params.set('status', status);
	return { page, search, status: params.get('status') ?? '', query: params.toString() };
}
