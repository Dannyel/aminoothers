import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { paginationArgs } from '../../common/dto/pagination.dto.js';
import { dateOnly, formatDateOnly } from '../../common/utils/dates.js';
import type { Lot, Prisma } from '../../generated/prisma/client.js';
import { LotStatus, MovementType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  AdjustmentDto,
  CreateLotDto,
  ListLotsQueryDto,
  LotDto,
  LotPageDto,
  LotStatusDto,
  OutflowDto,
} from './dto/inventory.dto.js';
import {
  InventorySettingsService,
  type ExpiryWindow,
} from './inventory-settings.service.js';
import { StockLedgerService } from './stock-ledger.service.js';

type Tx = Prisma.TransactionClient;

const lotInclude = {
  product: { select: { id: true, sku: true, name: true } },
} as const;
type LotRow = Prisma.LotGetPayload<{ include: typeof lotInclude }>;

export interface NewLotInput {
  productId: string;
  lotNumber: string;
  expirationDate?: string | null;
  manufacturingDate?: string | null;
  status: LotStatus;
}

@Injectable()
export class LotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedgerService,
    private readonly settings: InventorySettingsService,
  ) {}

  async list(query: ListLotsQueryDto): Promise<LotPageDto> {
    const window = await this.settings.window();
    const where: Prisma.LotWhereInput = {
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.withStock ? { qtyOnHand: { gt: 0 } } : {}),
      ...(query.expiry === 'expired'
        ? { expirationDate: { lt: dateOnly(window.today) } }
        : {}),
      ...(query.expiry === 'near'
        ? {
            expirationDate: {
              gte: dateOnly(window.today),
              lte: dateOnly(window.nearExpiryUntil),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { lotNumber: { contains: query.search, mode: 'insensitive' } },
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
      this.prisma.lot.findMany({
        where,
        include: lotInclude,
        orderBy: [
          { expirationDate: { sort: 'asc', nulls: 'last' } },
          { firstReceivedAt: 'asc' },
        ],
        ...paginationArgs(query),
      }),
      this.prisma.lot.count({ where }),
    ]);
    return {
      items: rows.map((row) => toLotDto(row, window)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<LotDto> {
    const lot = await this.prisma.lot.findUnique({
      where: { id },
      include: lotInclude,
    });
    if (!lot) throw new NotFoundException('Lote no encontrado');
    return toLotDto(lot, await this.settings.window());
  }

  /** Existencia inicial o ingreso fuera de una orden de compra. */
  async createWithStock(actor: AuthUser, dto: CreateLotDto): Promise<LotDto> {
    const lot = await this.prisma.$transaction(async (tx) => {
      const created = await this.createLot(tx, {
        productId: dto.productId,
        lotNumber: dto.lotNumber,
        expirationDate: dto.expirationDate,
        manufacturingDate: dto.manufacturingDate,
        status: dto.status ?? LotStatus.AVAILABLE,
      });
      await this.ledger.apply(tx, {
        lotId: created.id,
        type: MovementType.ADJUSTMENT_IN,
        quantity: dto.quantity,
        unitCost: dto.unitCost,
        reasonCode: 'INITIAL_STOCK',
        notes: dto.notes,
        userId: actor.id,
      });
      return created;
    });
    return this.get(lot.id);
  }

  async adjust(
    actor: AuthUser,
    id: string,
    dto: AdjustmentDto,
  ): Promise<LotDto> {
    await this.prisma.$transaction(async (tx) => {
      await this.findForUpdate(tx, id);
      const corrected = dto.correctsMovementNumber
        ? await tx.inventoryMovement.findFirst({
            where: { number: dto.correctsMovementNumber, lotId: id },
          })
        : null;
      if (dto.correctsMovementNumber && !corrected) {
        throw new BadRequestException(
          'El movimiento a corregir no existe en este lote',
        );
      }
      await this.ledger.apply(tx, {
        lotId: id,
        type:
          dto.direction === 'IN'
            ? MovementType.ADJUSTMENT_IN
            : MovementType.ADJUSTMENT_OUT,
        quantity: dto.direction === 'IN' ? dto.quantity : -dto.quantity,
        reasonCode: dto.reasonCode,
        notes: dto.notes,
        ...(corrected
          ? { referenceType: 'MOVEMENT', referenceId: corrected.id }
          : {}),
        userId: actor.id,
      });
    });
    return this.get(id);
  }

  /** Bajas: vencidos, dañados, retiro del mercado o devolución al proveedor. */
  async outflow(actor: AuthUser, id: string, dto: OutflowDto): Promise<LotDto> {
    await this.prisma.$transaction(async (tx) => {
      await this.findForUpdate(tx, id);
      await this.ledger.apply(tx, {
        lotId: id,
        type:
          dto.reasonCode === 'RETURN_TO_SUPPLIER'
            ? MovementType.RETURN_TO_SUPPLIER
            : MovementType.WRITE_OFF,
        quantity: -dto.quantity,
        reasonCode: dto.reasonCode,
        notes: dto.notes,
        userId: actor.id,
      });
    });
    return this.get(id);
  }

  /** Cuarentena, retiro del mercado, bloqueo o liberación. Sale de la venta al instante. */
  async setStatus(id: string, dto: LotStatusDto): Promise<LotDto> {
    if (dto.status !== LotStatus.AVAILABLE && !dto.reason) {
      throw new BadRequestException('Indique el motivo del cambio de estado');
    }
    await this.prisma.$transaction(async (tx) => {
      const lot = await this.findForUpdate(tx, id);
      if (dto.status !== LotStatus.AVAILABLE && lot.qtyReserved > 0) {
        throw new ConflictException(
          `El lote tiene ${lot.qtyReserved} unidad(es) reservada(s) para pedidos; gestione esos pedidos antes de retirarlo de la venta.`,
        );
      }
      await tx.lot.update({
        where: { id },
        data: {
          status: dto.status,
          statusReason: dto.status === LotStatus.AVAILABLE ? null : dto.reason,
        },
      });
    });
    return this.get(id);
  }

  /**
   * Crea un lote validando el vencimiento: obligatorio para medicamentos
   * (productos con principio activo) y nunca en el pasado.
   */
  async createLot(tx: Tx, input: NewLotInput): Promise<Lot> {
    const product = await tx.product.findFirst({
      where: { id: input.productId, deletedAt: null },
      include: { _count: { select: { activeIngredients: true } } },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    await this.assertExpiration(input, product._count.activeIngredients > 0);
    if (
      await tx.lot.findUnique({
        where: {
          productId_lotNumber: {
            productId: input.productId,
            lotNumber: input.lotNumber,
          },
        },
      })
    ) {
      throw new ConflictException(
        `El lote ${input.lotNumber} ya existe para este producto; registre un ajuste de entrada.`,
      );
    }
    const warehouse = await tx.warehouse.findFirstOrThrow({
      orderBy: { createdAt: 'asc' },
    });
    return tx.lot.create({
      data: {
        productId: input.productId,
        warehouseId: warehouse.id,
        lotNumber: input.lotNumber,
        expirationDate: input.expirationDate
          ? dateOnly(input.expirationDate)
          : null,
        manufacturingDate: input.manufacturingDate
          ? dateOnly(input.manufacturingDate)
          : null,
        status: input.status,
      },
    });
  }

  async assertExpiration(
    input: Pick<NewLotInput, 'expirationDate' | 'manufacturingDate'>,
    isMedicine: boolean,
  ): Promise<void> {
    const { today } = await this.settings.window();
    if (!input.expirationDate) {
      if (isMedicine) {
        throw new BadRequestException(
          'La fecha de vencimiento es obligatoria para medicamentos',
        );
      }
      return;
    }
    if (input.expirationDate < today) {
      throw new BadRequestException('No se puede ingresar un lote ya vencido');
    }
    if (
      input.manufacturingDate &&
      input.manufacturingDate > input.expirationDate
    ) {
      throw new BadRequestException(
        'La fecha de fabricación es posterior al vencimiento',
      );
    }
    if (input.manufacturingDate && input.manufacturingDate > today) {
      throw new BadRequestException(
        'La fecha de fabricación no puede ser futura',
      );
    }
  }

  private async findForUpdate(tx: Tx, id: string): Promise<Lot> {
    await tx.$queryRaw`SELECT 1 FROM lots WHERE id = ${id}::uuid FOR UPDATE`;
    const lot = await tx.lot.findUnique({ where: { id } });
    if (!lot) throw new NotFoundException('Lote no encontrado');
    return lot;
  }
}

export function toLotDto(lot: LotRow, window: ExpiryWindow): LotDto {
  const expiration = formatDateOnly(lot.expirationDate);
  const isExpired = expiration !== null && expiration < window.today;
  const belowShelfLife =
    expiration !== null && expiration < window.sellableFrom;
  const sellable = lot.status === LotStatus.AVAILABLE && !belowShelfLife;
  return {
    id: lot.id,
    product: lot.product,
    lotNumber: lot.lotNumber,
    expirationDate: expiration,
    manufacturingDate: formatDateOnly(lot.manufacturingDate),
    status: lot.status,
    statusReason: lot.statusReason,
    qtyOnHand: lot.qtyOnHand,
    qtyReserved: lot.qtyReserved,
    qtyAvailable: sellable ? lot.qtyOnHand - lot.qtyReserved : 0,
    isExpired,
    isNearExpiry:
      !isExpired && expiration !== null && expiration <= window.nearExpiryUntil,
    belowShelfLife,
    avgUnitCost: lot.avgUnitCost.toFixed(4),
    firstReceivedAt: lot.firstReceivedAt.toISOString(),
  };
}
