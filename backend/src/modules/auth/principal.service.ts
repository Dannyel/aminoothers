import { Injectable } from '@nestjs/common';
import {
  SUPER_ADMIN_ROLE,
  type AuthUser,
} from '../../common/auth/auth-user.js';
import { UserStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Carga el usuario de un access token desde la base de datos en cada petición.
 * Así un bloqueo, un cierre de sesión o un cambio de permisos tiene efecto
 * inmediato, sin esperar a que expire el token.
 */
@Injectable()
export class PrincipalService {
  constructor(private readonly prisma: PrismaService) {}

  async load(userId: string, sessionId: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        status: UserStatus.ACTIVE,
        sessions: {
          some: {
            familyId: sessionId,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        },
      },
      select: {
        id: true,
        type: true,
        email: true,
        roles: {
          select: {
            role: {
              select: {
                code: true,
                permissions: {
                  select: { permission: { select: { code: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!user) return null;

    const roles = user.roles.map((r) => r.role.code);
    const permissions = new Set(
      user.roles.flatMap((r) =>
        r.role.permissions.map((p) => p.permission.code),
      ),
    );
    return {
      id: user.id,
      type: user.type,
      email: user.email,
      sessionId,
      roles,
      permissions,
      isSuperAdmin: roles.includes(SUPER_ADMIN_ROLE),
    };
  }
}
