import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { NotificationStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { retentionCutoffs } from './retention.js';

/** Clave del candado de PostgreSQL: una sola instancia limpia a la vez. */
const RETENTION_LOCK_KEY = 6_003;
const HOUR_MS = 3_600_000;

export interface RetentionResult {
  notifications: number;
  auditLogs: number;
  sessions: number;
  tokens: number;
  mfaChallenges: number;
}

/**
 * Aplica los plazos de conservación (D20) una vez por hora como máximo:
 * borra los correos enviados antiguos, la auditoría de más de 5 años y las
 * sesiones, enlaces y desafíos vencidos. Los correos pendientes o fallidos
 * no se borran: esperan a enviarse o a que alguien los revise.
 */
@Injectable()
export class RetentionService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(RetentionService.name);
  private readonly enabled: boolean;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    // Mismo interruptor que los demás procesos en segundo plano: en las
    // pruebas se ejecuta a mano.
    this.enabled =
      config.get('NOTIFICATION_DISPATCH_INTERVAL_SECONDS', { infer: true }) > 0;
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) return;
    this.timer = setInterval(() => void this.tick(), HOUR_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async purge(now = new Date()): Promise<RetentionResult | null> {
    const cutoff = retentionCutoffs(now);
    return this.prisma.$transaction(
      async (tx) => {
        const [{ locked }] = await tx.$queryRaw<Array<{ locked: boolean }>>`
          SELECT pg_try_advisory_xact_lock(${RETENTION_LOCK_KEY}) AS locked`;
        if (!locked) return null;
        const notifications = await tx.notificationLog.deleteMany({
          where: {
            status: NotificationStatus.SENT,
            sentAt: { lt: cutoff.sentNotifications },
          },
        });
        const auditLogs = await tx.auditLog.deleteMany({
          where: { createdAt: { lt: cutoff.audit } },
        });
        const sessions = await tx.session.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: cutoff.sessions } },
              { revokedAt: { lt: cutoff.sessions } },
            ],
          },
        });
        const tokens = await tx.userToken.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: cutoff.tokens } },
              { usedAt: { lt: cutoff.tokens } },
            ],
          },
        });
        const mfaChallenges = await tx.mfaChallenge.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: cutoff.tokens } },
              { consumedAt: { lt: cutoff.tokens } },
            ],
          },
        });
        return {
          notifications: notifications.count,
          auditLogs: auditLogs.count,
          sessions: sessions.count,
          tokens: tokens.count,
          mfaChallenges: mfaChallenges.count,
        };
      },
      { timeout: 120_000 },
    );
  }

  private async tick(): Promise<void> {
    try {
      const result = await this.purge();
      if (result && Object.values(result).some((n) => n > 0)) {
        this.logger.log(`Retención aplicada: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      this.logger.error(
        'Falló la limpieza por retención',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
