import { Injectable } from '@nestjs/common';
import { paginationArgs } from '../../common/dto/pagination.dto.js';
import { addDays } from '../../common/utils/dates.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  ListMovementsQueryDto,
  MovementPageDto,
} from './dto/inventory.dto.js';

/** Kardex: historial de movimientos (solo lectura). */
@Injectable()
export class MovementsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListMovementsQueryDto): Promise<MovementPageDto> {
    // Las fechas se toman como días completos en hora de Guatemala (UTC-6).
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) createdAt.gte = new Date(`${query.from}T06:00:00Z`);
    if (query.to) createdAt.lt = new Date(`${addDays(query.to, 1)}T06:00:00Z`);
    const where: Prisma.InventoryMovementWhereInput = {
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.lotId ? { lotId: query.lotId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.from || query.to ? { createdAt } : {}),
      ...(query.search
        ? {
            OR: [
              {
                lot: {
                  lotNumber: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                product: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                product: {
                  sku: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.findMany({
        where,
        include: {
          lot: { select: { id: true, lotNumber: true } },
          product: { select: { id: true, sku: true, name: true } },
          user: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { number: 'desc' },
        ...paginationArgs(query),
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);
    return {
      items: rows.map((m) => ({
        id: m.id,
        number: m.number,
        type: m.type,
        quantity: m.quantity,
        balanceAfter: m.balanceAfter,
        unitCost: m.unitCost.toFixed(4),
        reasonCode: m.reasonCode,
        notes: m.notes,
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        lot: m.lot,
        product: m.product,
        user: { id: m.user.id, name: `${m.user.firstName} ${m.user.lastName}` },
        createdAt: m.createdAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
