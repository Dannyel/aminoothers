import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import {
  OrderStatus,
  PaymentStatus,
  ReservationStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ReservationsService } from '../inventory/reservations.service.js';
import { transitionOrder, transitionPayment } from './order-status.js';

/** Clave del candado de PostgreSQL: una sola instancia procesa a la vez. */
const SWEEP_LOCK_KEY = 6_001;
const BATCH_SIZE = 200;

/**
 * Vence los pedidos pendientes cuya reserva caducó (D3): libera las unidades,
 * marca el pedido como EXPIRED y cancela su pago pendiente. Un pedido con
 * comprobante en revisión (PAYMENT_IN_REVIEW) no vence.
 */
@Injectable()
export class ReservationExpiryService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ReservationExpiryService.name);
  private readonly intervalMs: number;
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: ReservationsService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.intervalMs =
      config.get('RESERVATION_SWEEP_INTERVAL_SECONDS', { infer: true }) * 1000;
  }

  onApplicationBootstrap(): void {
    if (this.intervalMs <= 0) return;
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  /** Procesa los pedidos vencidos. Devuelve cuántos venció. */
  async expireDue(now = new Date()): Promise<number> {
    return this.prisma.$transaction(
      async (tx) => {
        const [{ locked }] = await tx.$queryRaw<Array<{ locked: boolean }>>`
          SELECT pg_try_advisory_xact_lock(${SWEEP_LOCK_KEY}) AS locked`;
        if (!locked) return 0;

        const due = await tx.$queryRaw<
          Array<{ id: string; status: OrderStatus }>
        >`
          SELECT id, status FROM orders
          WHERE status IN ('PENDING_PAYMENT', 'PENDING_CONFIRMATION')
            AND reservation_expires_at <= ${now}
          ORDER BY reservation_expires_at
          LIMIT ${BATCH_SIZE}
          FOR UPDATE SKIP LOCKED`;

        for (const order of due) {
          await this.reservations.releaseForOrder(
            tx,
            order.id,
            ReservationStatus.EXPIRED,
          );
          await transitionOrder(
            tx,
            order,
            OrderStatus.EXPIRED,
            null,
            'Venció el plazo de la reserva',
          );
          const payments = await tx.payment.findMany({
            where: { orderId: order.id, status: PaymentStatus.PENDING },
            select: { id: true, status: true },
          });
          for (const payment of payments) {
            await transitionPayment(
              tx,
              payment,
              PaymentStatus.CANCELLED,
              null,
              'Pedido vencido',
            );
          }
        }
        return due.length;
      },
      { timeout: 60_000 },
    );
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const expired = await this.expireDue();
      if (expired > 0)
        this.logger.log(`Pedidos vencidos por reserva: ${expired}`);
    } catch (error) {
      this.logger.error(
        'Falló el vencimiento de reservas',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}
