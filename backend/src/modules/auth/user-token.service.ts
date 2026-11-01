import { BadRequestException, Injectable } from '@nestjs/common';
import { generateToken, sha256 } from '../../common/utils/crypto.js';
import { UserTokenPurpose } from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export const TOKEN_TTL_MS: Record<UserTokenPurpose, number> = {
  [UserTokenPurpose.PASSWORD_RESET]: 30 * 60_000,
  [UserTokenPurpose.EMAIL_VERIFICATION]: 48 * 3_600_000,
};

/** Invitación de personal: es un PASSWORD_RESET con vigencia mayor. */
export const STAFF_INVITATION_TTL_MS = 72 * 3_600_000;

type Tx = Prisma.TransactionClient;

/** Tokens de un solo uso enviados por correo (recuperación y verificación). */
@Injectable()
export class UserTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /** Emite un token nuevo e invalida los anteriores sin usar del mismo propósito. */
  async issue(
    userId: string,
    purpose: UserTokenPurpose,
    ttlMs = TOKEN_TTL_MS[purpose],
    tx: Tx = this.prisma,
  ): Promise<string> {
    const token = generateToken();
    const now = new Date();
    await tx.userToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: now },
    });
    await tx.userToken.create({
      data: {
        userId,
        purpose,
        tokenHash: sha256(token),
        expiresAt: new Date(now.getTime() + ttlMs),
      },
    });
    return token;
  }

  /**
   * Marca el token como usado y devuelve el id del usuario. La actualización es
   * condicional, así que dos usos simultáneos no pueden tener éxito ambos.
   */
  async consume(
    token: string,
    purpose: UserTokenPurpose,
    tx: Tx,
  ): Promise<string> {
    const now = new Date();
    const record = await tx.userToken.findUnique({
      where: { tokenHash: sha256(token) },
      select: { id: true, userId: true, purpose: true },
    });
    const { count } = record
      ? await tx.userToken.updateMany({
          where: {
            id: record.id,
            purpose,
            usedAt: null,
            expiresAt: { gt: now },
          },
          data: { usedAt: now },
        })
      : { count: 0 };
    if (!record || count === 0) {
      throw new BadRequestException(
        'El enlace no es válido o ya venció. Solicite uno nuevo.',
      );
    }
    return record.userId;
  }
}
