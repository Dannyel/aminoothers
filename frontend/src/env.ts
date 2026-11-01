import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	API_URL: {
		description: 'URL base del backend NestJS (sin /api/v1). Solo se usa en el servidor.',
		schema: (value) => {
			if (!value) throw new Error('API_URL es obligatoria');
			const url = new URL(value);
			if (url.protocol !== 'http:' && url.protocol !== 'https:') {
				throw new Error('API_URL debe usar http o https');
			}
			return url.origin;
		}
	}
});
