import type { UserType } from '../../generated/prisma/client.js';

/** Usuario autenticado de la petición actual (lo coloca AuthGuard en request.user). */
export interface AuthUser {
  id: string;
  type: UserType;
  email: string;
  /** Familia de sesión (refresh tokens) a la que pertenece el access token. */
  sessionId: string;
  roles: string[];
  permissions: ReadonlySet<string>;
  isSuperAdmin: boolean;
}

export const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';
