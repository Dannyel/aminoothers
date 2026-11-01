import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import type { UserType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PERMISSION_CATALOG } from '../roles/permissions.catalog.js';
import type { AccessTokenPayload } from './auth.guard.js';
import type { AuthTokensDto, MeResponseDto } from './dto/auth-responses.dto.js';
import {
  SessionService,
  type ClientMeta,
  type IssuedSession,
} from './session.service.js';

/** Emite el par access/refresh token y arma el perfil del usuario autenticado. */
@Injectable()
export class SessionTokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly sessions: SessionService,
  ) {}

  /** Inicia una sesión nueva. Solo debe llamarse tras completar el doble factor. */
  async startSession(
    userId: string,
    type: UserType,
    meta: ClientMeta,
  ): Promise<AuthTokensDto> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
    const session = await this.sessions.start(userId, type, meta);
    return this.build(userId, session);
  }

  async build(
    userId: string,
    session: Pick<IssuedSession, 'familyId' | 'refreshToken' | 'expiresAt'>,
  ): Promise<AuthTokensDto> {
    const user = await this.me(userId);
    const ttl = this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
    const payload: AccessTokenPayload = {
      sub: user.id,
      typ: user.type,
      sid: session.familyId,
    };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: ttl });
    return {
      accessToken,
      accessTokenExpiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      refreshToken: session.refreshToken,
      refreshTokenExpiresAt: session.expiresAt.toISOString(),
      user,
    };
  }

  async me(userId: string): Promise<MeResponseDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
    const roles = user.roles.map((r) => r.role.code);
    const permissions = roles.includes('SUPER_ADMIN')
      ? PERMISSION_CATALOG.map((p) => p.code)
      : [
          ...new Set(
            user.roles.flatMap((r) =>
              r.role.permissions.map((p) => p.permission.code),
            ),
          ),
        ];
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      type: user.type,
      emailVerified: user.emailVerifiedAt !== null,
      mfaEnabled: user.totpEnabledAt !== null,
      roles,
      permissions: permissions.sort(),
    };
  }
}
