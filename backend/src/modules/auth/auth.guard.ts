import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AuthUser } from '../../common/auth/auth-user.js';
import {
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
  USER_TYPE_KEY,
} from '../../common/decorators/auth.decorators.js';
import { UserType } from '../../generated/prisma/enums.js';
import { PrincipalService } from './principal.service.js';

export interface AccessTokenPayload {
  sub: string;
  typ: UserType;
  sid: string;
}

/**
 * Guard global: toda ruta requiere access token salvo las marcadas con
 * @Public(). Además aplica @CustomerOnly/@StaffOnly y @RequirePermissions.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly principals: PrincipalService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets))
      return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const token = bearerToken(request);
    if (!token) throw new UnauthorizedException('Debe iniciar sesión');

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException(
        'La sesión expiró. Inicie sesión de nuevo.',
      );
    }
    const user = await this.principals.load(payload.sub, payload.sid);
    if (!user) throw new UnauthorizedException('La sesión ya no es válida');
    request.user = user;

    const requiredType = this.reflector.getAllAndOverride<UserType>(
      USER_TYPE_KEY,
      targets,
    );
    const permissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      targets,
    );
    if (requiredType && user.type !== requiredType) {
      throw new ForbiddenException('No tiene acceso a esta sección');
    }
    if (permissions?.length) {
      const allowed =
        user.type === UserType.STAFF &&
        (user.isSuperAdmin ||
          permissions.every((p) => user.permissions.has(p)));
      if (!allowed)
        throw new ForbiddenException('No tiene permiso para esta operación');
    }
    return true;
  }
}

function bearerToken(request: Request): string | undefined {
  const [scheme, value] = request.headers.authorization?.split(' ') ?? [];
  return scheme === 'Bearer' && value ? value : undefined;
}
