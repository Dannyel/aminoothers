import {
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserType } from '../../generated/prisma/enums.js';
import type { AuthUser } from '../auth/auth-user.js';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const USER_TYPE_KEY = 'auth:userType';
export const PERMISSIONS_KEY = 'auth:permissions';
export const AUTH_RATE_LIMIT_KEY = 'auth:rateLimit';

/** El endpoint no requiere autenticación. Todo lo demás la requiere. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Solo clientes autenticados (tienda). */
export const CustomerOnly = () =>
  applyDecorators(
    SetMetadata(USER_TYPE_KEY, UserType.CUSTOMER),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'No autenticado' }),
    ApiForbiddenResponse({ description: 'Solo para clientes' }),
  );

/** Solo personal administrativo (panel). */
export const StaffOnly = () =>
  applyDecorators(
    SetMetadata(USER_TYPE_KEY, UserType.STAFF),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'No autenticado' }),
    ApiForbiddenResponse({ description: 'Sin permiso' }),
  );

/** Permisos requeridos (todos). Implica usuario STAFF. */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Aplica el límite estricto de peticiones de autenticación (AUTH_THROTTLE_LIMIT). */
export const AuthRateLimit = () => SetMetadata(AUTH_RATE_LIMIT_KEY, true);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest<{ user: AuthUser }>().user,
);
