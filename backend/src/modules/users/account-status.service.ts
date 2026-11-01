import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  SUPER_ADMIN_ROLE,
  type AuthUser,
} from '../../common/auth/auth-user.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { UserStatus, UserType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SessionService } from '../auth/session.service.js';

/** Clave del candado de transacción que serializa los cambios sobre superadministradores. */
const SUPER_ADMIN_LOCK_KEY = 4_112_026;

/** Bloqueo, desactivación y reactivación de cuentas (personal y clientes). */
@Injectable()
export class AccountStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  async changeStatus(
    actor: AuthUser,
    userId: string,
    type: UserType,
    status: UserStatus,
  ): Promise<void> {
    if (actor.id === userId) {
      throw new BadRequestException(
        'No puede cambiar el estado de su propia cuenta',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({ where: { id: userId, type } });
      if (!user) throw new NotFoundException('Usuario no encontrado');
      if (type === UserType.STAFF && status !== UserStatus.ACTIVE) {
        await this.assertNotLastSuperAdmin(tx, userId);
      }
      await tx.user.update({
        where: { id: userId },
        data:
          status === UserStatus.ACTIVE
            ? { status, failedLoginAttempts: 0, lockedUntil: null }
            : { status },
      });
    });
    if (status !== UserStatus.ACTIVE) {
      await this.sessions.revokeAllForUser(userId);
    }
  }

  /**
   * Impide dejar el sistema sin superadministradores activos. Debe llamarse
   * dentro de la transacción que quita el rol o desactiva al usuario.
   */
  async assertNotLastSuperAdmin(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<void> {
    // $executeRaw: la función devuelve void, que $queryRaw no puede deserializar.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SUPER_ADMIN_LOCK_KEY})`;
    const isSuperAdmin = await tx.userRole.count({
      where: { userId, role: { code: SUPER_ADMIN_ROLE } },
    });
    if (!isSuperAdmin) return;
    const others = await tx.user.count({
      where: {
        id: { not: userId },
        type: UserType.STAFF,
        status: UserStatus.ACTIVE,
        roles: { some: { role: { code: SUPER_ADMIN_ROLE } } },
      },
    });
    if (others === 0) {
      throw new ConflictException(
        'Debe quedar al menos un superadministrador activo',
      );
    }
  }
}
