import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from '../../common/utils/money.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PromotionType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  PromotionDto,
  PromotionInputDto,
  PromotionPageDto,
  PromotionsQueryDto,
  PromotionState,
  UpdatePromotionDto,
} from './dto/promotions.dto.js';
import { bestPromotion, type AppliedPromotion } from './promotion-pricing.js';

type Client = Pick<PrismaService, 'promotion'>;

const include = {
  products: {
    include: {
      product: { select: { id: true, sku: true, name: true, price: true } },
    },
  },
} satisfies Prisma.PromotionInclude;

type Row = Prisma.PromotionGetPayload<{ include: typeof include }>;

/**
 * Promociones sencillas (porcentaje o monto fijo, con vigencia y productos).
 * El precio normal del producto no cambia; el descuento se calcula aquí y lo
 * aplican la tienda, el carrito y el checkout.
 */
@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mejor promoción vigente por producto en el instante `at`. Dentro de una
   * transacción se pasa su cliente para leer lo mismo que se va a guardar.
   */
  async bestFor(
    products: ReadonlyArray<{ id: string; price: Prisma.Decimal }>,
    at = new Date(),
    client: Client = this.prisma,
  ): Promise<Map<string, AppliedPromotion>> {
    if (products.length === 0) return new Map();
    const ids = products.map((p) => p.id);
    const promotions = await client.promotion.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        startsAt: { lte: at },
        endsAt: { gt: at },
        products: { some: { productId: { in: ids } } },
      },
      include: {
        products: {
          where: { productId: { in: ids } },
          select: { productId: true },
        },
      },
    });
    const result = new Map<string, AppliedPromotion>();
    for (const product of products) {
      const best = bestPromotion(
        promotions.filter((p) =>
          p.products.some((pp) => pp.productId === product.id),
        ),
        product.price,
      );
      if (best) result.set(product.id, best);
    }
    return result;
  }

  async list(query: PromotionsQueryDto): Promise<PromotionPageDto> {
    const now = new Date();
    const where: Prisma.PromotionWhereInput = {
      deletedAt: null,
      ...(query.search
        ? { name: { contains: query.search.trim(), mode: 'insensitive' } }
        : {}),
      ...stateWhere(query.state, now),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.promotion.findMany({
        where,
        include,
        orderBy: [{ startsAt: 'desc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.promotion.count({ where }),
    ]);
    return {
      items: rows.map((r) => toDto(r, now)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<PromotionDto> {
    return toDto(await this.find(id), new Date());
  }

  async create(actorId: string, dto: PromotionInputDto): Promise<PromotionDto> {
    await this.assertTerms(
      dto.type,
      dto.value,
      dto.startsAt,
      dto.endsAt,
      dto.productIds,
    );
    const { productIds, ...fields } = dto;
    const created = await this.prisma.promotion.create({
      data: {
        ...fields,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        createdById: actorId,
        products: { create: productIds.map((productId) => ({ productId })) },
      },
    });
    return this.get(created.id);
  }

  async update(id: string, dto: UpdatePromotionDto): Promise<PromotionDto> {
    const current = await this.find(id);
    await this.assertTerms(
      dto.type ?? current.type,
      dto.value ?? current.value.toFixed(2),
      dto.startsAt ?? current.startsAt.toISOString(),
      dto.endsAt ?? current.endsAt.toISOString(),
      dto.productIds ?? current.products.map((p) => p.productId),
    );
    const { productIds, startsAt, endsAt, ...fields } = dto;
    await this.prisma.$transaction(async (tx) => {
      await tx.promotion.update({
        where: { id },
        data: {
          ...fields,
          ...(startsAt ? { startsAt: new Date(startsAt) } : {}),
          ...(endsAt ? { endsAt: new Date(endsAt) } : {}),
        },
      });
      if (productIds) {
        await tx.promotionProduct.deleteMany({ where: { promotionId: id } });
        await tx.promotionProduct.createMany({
          data: productIds.map((productId) => ({ promotionId: id, productId })),
        });
      }
    });
    return this.get(id);
  }

  /** Baja lógica: los pedidos conservan la promoción que se les aplicó. */
  async remove(id: string): Promise<void> {
    await this.find(id);
    await this.prisma.promotion.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  private async find(id: string): Promise<Row> {
    const row = await this.prisma.promotion.findFirst({
      where: { id, deletedAt: null },
      include,
    });
    if (!row) throw new NotFoundException('Promoción no encontrada');
    return row;
  }

  /**
   * Vigencia coherente, porcentaje hasta 100 y productos existentes. Un monto
   * fijo debe ser menor que el precio de cada producto: una promoción no
   * regala productos.
   */
  private async assertTerms(
    type: PromotionType,
    value: string,
    startsAt: string,
    endsAt: string,
    productIds: string[],
  ): Promise<void> {
    if (new Date(endsAt) <= new Date(startsAt)) {
      throw new BadRequestException(
        'La promoción debe terminar después de empezar',
      );
    }
    const amount = new Decimal(value);
    if (type === PromotionType.PERCENTAGE && amount.gt(100)) {
      throw new BadRequestException('El porcentaje no puede superar 100');
    }
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, deletedAt: null },
      select: { id: true, name: true, price: true },
    });
    if (products.length !== productIds.length) {
      throw new NotFoundException(
        'Algún producto no existe o fue dado de baja',
      );
    }
    if (type === PromotionType.FIXED_AMOUNT) {
      const tooHigh = products.find((p) => amount.gte(p.price));
      if (tooHigh) {
        throw new BadRequestException(
          `El descuento debe ser menor que el precio de «${tooHigh.name}» (Q${tooHigh.price.toFixed(2)})`,
        );
      }
    }
  }
}

function stateWhere(
  state: PromotionState | undefined,
  now: Date,
): Prisma.PromotionWhereInput {
  switch (state) {
    case 'ACTIVE':
      return { isActive: true, startsAt: { lte: now }, endsAt: { gt: now } };
    case 'SCHEDULED':
      return { isActive: true, startsAt: { gt: now } };
    case 'EXPIRED':
      return { endsAt: { lte: now } };
    case 'INACTIVE':
      return { isActive: false };
    default:
      return {};
  }
}

function stateOf(row: Row, now: Date): PromotionState {
  if (!row.isActive) return 'INACTIVE';
  if (row.endsAt <= now) return 'EXPIRED';
  return row.startsAt > now ? 'SCHEDULED' : 'ACTIVE';
}

function toDto(row: Row, now: Date): PromotionDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    value: row.value.toFixed(2),
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    isActive: row.isActive,
    state: stateOf(row, now),
    products: row.products
      .map((p) => ({
        id: p.product.id,
        sku: p.product.sku,
        name: p.product.name,
        price: p.product.price.toFixed(2),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    createdAt: row.createdAt.toISOString(),
  };
}
