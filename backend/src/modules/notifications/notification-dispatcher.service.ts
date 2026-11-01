import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { todayInBusinessZone } from '../../common/utils/dates.js';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  NotificationStatus,
  NotificationType,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StockService } from '../inventory/stock.service.js';
import { MailService } from '../mail/mail.service.js';
import type { NotificationPayloads } from './notification-payloads.js';
import {
  renderNotification,
  type TemplateContext,
} from './notification-templates.js';

export const MAX_ATTEMPTS = 5;
/** Espera antes de cada reintento (minutos), tras los intentos 1 a 4. */
export const RETRY_DELAYS_MINUTES = [1, 5, 15, 60];
const BATCH_SIZE = 20;
/** Un envío reclamado y no resuelto (caída del proceso) se reintenta tras este plazo. */
const LEASE_MINUTES = 5;

interface ClaimedRow {
  id: string;
  type: NotificationType;
  recipient: string;
  payload: unknown;
  attempts: number;
  created_at: Date;
}

export interface DispatchResult {
  sent: number;
  retried: number;
  failed: number;
}

/**
 * Envía la bandeja de salida: reclama un lote de pendientes con
 * `FOR UPDATE SKIP LOCKED` (varias instancias no envían el mismo correo),
 * envía fuera de la transacción y registra el resultado. Una falla se
 * reintenta con espera creciente hasta MAX_ATTEMPTS; después queda FAILED
 * para reintentarse desde el panel. También encola el resumen diario de
 * inventario para el buzón del personal.
 */
@Injectable()
export class NotificationDispatcherService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationDispatcherService.name);
  private readonly intervalMs: number;
  private readonly digestHour: number;
  private readonly frontendUrl: string;
  private timer?: NodeJS.Timeout;
  private running = false;
  /** Día (Guatemala) del último resumen revisado, para no consultar en cada ciclo. */
  private digestCheckedFor?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly stock: StockService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.intervalMs =
      config.get('NOTIFICATION_DISPATCH_INTERVAL_SECONDS', { infer: true }) *
      1000;
    this.digestHour = config.get('INVENTORY_DIGEST_HOUR', { infer: true });
    this.frontendUrl = config.get('FRONTEND_URL', { infer: true });
  }

  onApplicationBootstrap(): void {
    if (this.intervalMs <= 0) return;
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  /** Envía los correos pendientes cuyo turno llegó. */
  async dispatchDue(now = new Date()): Promise<DispatchResult> {
    const leaseUntil = new Date(now.getTime() + LEASE_MINUTES * 60_000);
    const claimed = await this.prisma.$queryRaw<ClaimedRow[]>`
      UPDATE notification_logs
      SET attempts = attempts + 1, next_attempt_at = ${leaseUntil}, updated_at = now()
      WHERE id IN (
        SELECT id FROM notification_logs
        WHERE status = 'PENDING' AND next_attempt_at <= ${now}
        ORDER BY next_attempt_at
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED)
      RETURNING id, type, recipient, payload, attempts, created_at`;
    // RETURNING no garantiza orden: se envían en el orden en que se encolaron.
    claimed.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
    const result: DispatchResult = { sent: 0, retried: 0, failed: 0 };
    if (claimed.length === 0) return result;

    const context = await this.templateContext();
    for (const row of claimed) {
      try {
        const mail = renderNotification(
          row.type,
          row.payload as NotificationPayloads[typeof row.type],
          context,
        );
        await this.mail.send({ to: row.recipient, ...mail });
        await this.prisma.notificationLog.update({
          where: { id: row.id },
          data: {
            status: NotificationStatus.SENT,
            sentAt: new Date(),
            subject: mail.subject.slice(0, 300),
            lastError: null,
          },
        });
        result.sent++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const exhausted = row.attempts >= MAX_ATTEMPTS;
        await this.prisma.notificationLog.update({
          where: { id: row.id },
          data: exhausted
            ? {
                status: NotificationStatus.FAILED,
                lastError: message.slice(0, 1000),
              }
            : {
                nextAttemptAt: new Date(
                  now.getTime() +
                    RETRY_DELAYS_MINUTES[row.attempts - 1] * 60_000,
                ),
                lastError: message.slice(0, 1000),
              },
        });
        if (exhausted) result.failed++;
        else result.retried++;
        this.logger.warn(
          `Correo ${row.type} a ${row.recipient}: intento ${row.attempts} fallido (${message})`,
        );
      }
    }
    return result;
  }

  /**
   * Encola una vez al día (desde INVENTORY_DIGEST_HOUR, hora de Guatemala)
   * el resumen de alertas de inventario, si hay buzón del personal y alguna
   * alerta. La clave única impide duplicados entre instancias. Devuelve si
   * lo encoló.
   */
  async enqueueInventoryDigest(now = new Date()): Promise<boolean> {
    const today = todayInBusinessZone(now);
    if (businessHour(now) < this.digestHour || this.digestCheckedFor === today)
      return false;
    const dedupeKey = `INVENTORY_DIGEST:${today}`;
    const [settings, existing] = await Promise.all([
      this.prisma.storeSettings.findUnique({
        where: { id: 1 },
        select: { staffAlertEmail: true },
      }),
      this.prisma.notificationLog.findUnique({ where: { dedupeKey } }),
    ]);
    if (existing) {
      this.digestCheckedFor = today;
      return false;
    }
    if (!settings?.staffAlertEmail) return false;

    const alerts = await this.stock.alerts();
    this.digestCheckedFor = today;
    if (Object.values(alerts).every((count) => count === 0)) return false;
    const payload: NotificationPayloads['STAFF_INVENTORY_DIGEST'] = {
      date: today,
      lowStockProducts: alerts.lowStockProducts,
      expiredLots: alerts.expiredLots,
      nearExpiryLots: alerts.nearExpiryLots,
      quarantineLots: alerts.quarantineLots,
      recalledLots: alerts.recalledLots,
    };
    try {
      await this.prisma.notificationLog.create({
        data: {
          type: NotificationType.STAFF_INVENTORY_DIGEST,
          recipient: settings.staffAlertEmail,
          payload: payload as unknown as Prisma.InputJsonValue,
          dedupeKey,
        },
      });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return false;
      }
      throw error;
    }
  }

  /** Datos que usan las plantillas (nombre de la farmacia y URL pública). */
  async templateContext(): Promise<TemplateContext> {
    const settings = await this.prisma.storeSettings.findUnique({
      where: { id: 1 },
      select: { tradeName: true },
    });
    return {
      frontendUrl: this.frontendUrl,
      storeName: settings?.tradeName ?? 'Farmacia en línea',
    };
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.enqueueInventoryDigest();
      const result = await this.dispatchDue();
      if (result.sent + result.retried + result.failed > 0) {
        this.logger.log(
          `Correos enviados: ${result.sent}, por reintentar: ${result.retried}, fallidos: ${result.failed}`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Falló el envío de la bandeja de correos',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}

/** Hora del día en Guatemala (UTC−6 todo el año). */
export function businessHour(now: Date): number {
  return (now.getUTCHours() + 18) % 24;
}
