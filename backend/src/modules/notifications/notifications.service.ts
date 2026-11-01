import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { paginationArgs } from '../../common/dto/pagination.dto.js';
import type { NotificationLog, Prisma } from '../../generated/prisma/client.js';
import { NotificationStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  NotificationDto,
  NotificationPageDto,
  NotificationPreviewDto,
  NotificationsQueryDto,
} from './dto/notifications.dto.js';
import { NotificationDispatcherService } from './notification-dispatcher.service.js';
import type { NotificationPayloads } from './notification-payloads.js';
import { renderNotification } from './notification-templates.js';

/** Consulta de la bandeja de salida y reintento manual de los fallidos. */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificationDispatcherService,
  ) {}

  async list(query: NotificationsQueryDto): Promise<NotificationPageDto> {
    const where: Prisma.NotificationLogWhereInput = {
      status: query.status,
      type: query.type,
      ...(query.search
        ? {
            OR: [
              { recipient: { contains: query.search, mode: 'insensitive' } },
              { subject: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(query),
      }),
      this.prisma.notificationLog.count({ where }),
    ]);
    return {
      items: rows.map(toDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<NotificationPreviewDto> {
    const row = await this.find(id);
    const mail = renderNotification(
      row.type,
      row.payload as unknown as NotificationPayloads[typeof row.type],
      await this.dispatcher.templateContext(),
    );
    return Object.assign(toDto(row), {
      previewSubject: mail.subject,
      previewText: mail.text,
    });
  }

  /** Un correo fallido vuelve a la cola con sus intentos reiniciados. */
  async retry(id: string): Promise<NotificationDto> {
    const row = await this.find(id);
    if (row.status !== NotificationStatus.FAILED) {
      throw new ConflictException('Solo se reintentan los correos fallidos');
    }
    const updated = await this.prisma.notificationLog.update({
      where: { id },
      data: {
        status: NotificationStatus.PENDING,
        attempts: 0,
        nextAttemptAt: new Date(),
      },
    });
    return toDto(updated);
  }

  private async find(id: string): Promise<NotificationLog> {
    const row = await this.prisma.notificationLog.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Correo no encontrado');
    return row;
  }
}

function toDto(row: NotificationLog): NotificationDto {
  const payload = row.payload as { number?: unknown } | null;
  const isOrder = row.relatedType === 'order';
  return {
    id: row.id,
    type: row.type,
    recipient: row.recipient,
    subject: row.subject,
    status: row.status,
    attempts: row.attempts,
    nextAttemptAt: row.nextAttemptAt.toISOString(),
    lastError: row.lastError,
    sentAt: row.sentAt?.toISOString() ?? null,
    orderId: isOrder ? row.relatedId : null,
    orderNumber:
      isOrder && typeof payload?.number === 'number' ? payload.number : null,
    createdAt: row.createdAt.toISOString(),
  };
}
