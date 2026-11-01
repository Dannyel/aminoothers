import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { generateToken, sha256 } from '../../common/utils/crypto.js';
import { UserStatus, UserType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Margen en el que un refresh token recién rotado todavía se acepta. Cubre
 * peticiones paralelas del BFF que renuevan con el mismo token; fuera de este
 * margen, reutilizar un token rotado se trata como robo y revoca la sesión.
 */
export const REFRESH_REUSE_GRACE_MS = 30_000;

export interface ClientMeta {
  ip?: string;
  userAgent?: string;
}

export interface IssuedSession {
  familyId: string;
  refreshToken: string;
  expiresAt: Date;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /** Inicia una sesión nueva (familia nueva de refresh tokens). */
  async start(
    userId: string,
    type: UserType,
    meta: ClientMeta,
  ): Promise<IssuedSession> {
    const refreshToken = generateToken();
    const expiresAt = this.expiry(type);
    // La familia toma el id de su primer token.
    const id = randomUUID();
    await this.prisma.session.create({
      data: {
        id,
        familyId: id,
        userId,
        tokenHash: sha256(refreshToken),
        expiresAt,
        ...this.metaFields(meta),
      },
    });
    return { familyId: id, refreshToken, expiresAt };
  }

  /**
   * Rota un refresh token: devuelve uno nuevo de la misma familia y deja el
   * anterior revocado. La vigencia se extiende con cada rotación.
   */
  async rotate(
    refreshToken: string,
    meta: ClientMeta,
  ): Promise<IssuedSession & { userId: string }> {
    const now = new Date();
    const outcome = await this.prisma.$transaction(async (tx) => {
      const current = await tx.session.findUnique({
        where: { tokenHash: sha256(refreshToken) },
        include: { user: { select: { type: true, status: true } } },
      });
      if (
        !current ||
        current.expiresAt <= now ||
        current.user.status !== UserStatus.ACTIVE
      ) {
        return { kind: 'invalid' as const };
      }
      if (current.revokedAt) {
        const rotatedRecently =
          current.replacedById !== null &&
          now.getTime() - current.revokedAt.getTime() < REFRESH_REUSE_GRACE_MS;
        if (!rotatedRecently) {
          await tx.session.updateMany({
            where: { familyId: current.familyId, revokedAt: null },
            data: { revokedAt: now },
          });
          return { kind: 'reused' as const };
        }
        // Dentro del margen: la familia sigue vigente si algún token no está revocado.
        const active = await tx.session.count({
          where: {
            familyId: current.familyId,
            revokedAt: null,
            expiresAt: { gt: now },
          },
        });
        if (active === 0) return { kind: 'invalid' as const };
      }

      const nextToken = generateToken();
      const expiresAt = this.expiry(current.user.type);
      const next = await tx.session.create({
        data: {
          familyId: current.familyId,
          userId: current.userId,
          tokenHash: sha256(nextToken),
          expiresAt,
          ...this.metaFields(meta),
        },
      });
      if (!current.revokedAt) {
        await tx.session.update({
          where: { id: current.id },
          data: { revokedAt: now, replacedById: next.id },
        });
      }
      return {
        kind: 'ok' as const,
        session: {
          userId: current.userId,
          familyId: current.familyId,
          refreshToken: nextToken,
          expiresAt,
        },
      };
    });

    if (outcome.kind !== 'ok') {
      throw new UnauthorizedException(
        'La sesión expiró. Inicie sesión de nuevo.',
      );
    }
    return outcome.session;
  }

  /** Cierra una sesión (todos los tokens de la familia). */
  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Cierra todas las sesiones del usuario, salvo opcionalmente la actual. */
  async revokeAllForUser(
    userId: string,
    exceptFamilyId?: string,
  ): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptFamilyId ? { familyId: { not: exceptFamilyId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  }

  private expiry(type: UserType): Date {
    const ms =
      type === UserType.STAFF
        ? this.config.get('REFRESH_TTL_STAFF_HOURS', { infer: true }) *
          3_600_000
        : this.config.get('REFRESH_TTL_CUSTOMER_DAYS', { infer: true }) *
          86_400_000;
    return new Date(Date.now() + ms);
  }

  private metaFields(meta: ClientMeta) {
    return {
      ip: meta.ip?.slice(0, 64),
      userAgent: meta.userAgent?.slice(0, 500),
    };
  }
}
