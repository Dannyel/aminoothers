// See https://svelte.dev/docs/kit/types#app.d.ts
import type { Me } from '#lib/api/types.ts';
import type { ApiClient } from '#lib/server/api.ts';

declare global {
	namespace App {
		interface Locals {
			/** Usuario autenticado de la petición, o null. */
			user: Me | null;
			accessToken?: string;
			/** Cliente de la API con la IP del cliente y, si hay sesión, su token. */
			api: ApiClient;
		}
	}
}

export {};
