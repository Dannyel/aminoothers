import { BadRequestException, Injectable } from '@nestjs/common';
import { paginationArgs } from '../../common/dto/pagination.dto.js';
import { addDays, businessDayStart } from '../../common/utils/dates.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  AuditFiltersDto,
  AuditLogDto,
  AuditPageDto,
  AuditQueryDto,
} from './dto/audit.dto.js';

const userSelect = {
  select: { id: true, firstName: true, lastName: true, email: true },
} as const;

/** Consulta del registro de auditoría (solo lectura). */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AuditQueryDto): Promise<AuditPageDto> {
    if (query.from && query.to && query.to < query.from) {
      throw new BadRequestException('El rango de fechas es inválido');
    }
    const where: Prisma.AuditLogWhereInput = {
      module: query.module,
      userId: query.userId,
      entityId: query.entityId,
      createdAt:
        query.from || query.to
          ? {
              gte: query.from ? businessDayStart(query.from) : undefined,
              lt: query.to ? businessDayStart(addDays(query.to, 1)) : undefined,
            }
          : undefined,
      ...(query.search
        ? {
            OR: [
              { action: { contains: query.search, mode: 'insensitive' } },
              { route: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { user: userSelect },
        orderBy: { id: 'desc' },
        ...paginationArgs(query),
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      items: rows.map((r): AuditLogDto => ({
        id: r.id.toString(),
        createdAt: r.createdAt.toISOString(),
        user: r.user
          ? {
              id: r.user.id,
              name: `${r.user.firstName} ${r.user.lastName}`,
              email: r.user.email,
            }
          : null,
        action: r.action,
        module: r.module,
        route: r.route,
        entityId: r.entityId,
        changes: (r.changes as Record<string, unknown> | null) ?? null,
        statusCode: r.statusCode,
        ip: r.ip,
        userAgent: r.userAgent,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Módulos y usuarios que aparecen en el registro, para los filtros. */
  async filters(): Promise<AuditFiltersDto> {
    const [modules, users] = await Promise.all([
      this.prisma.$queryRaw<Array<{ module: string }>>`
        SELECT DISTINCT module FROM audit_logs ORDER BY module`,
      this.prisma.user.findMany({
        where: { auditLogs: { some: {} } },
        ...userSelect,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
    ]);
    return {
      modules: modules.map((m) => m.module),
      users: users.map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
      })),
    };
  }
}
