import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ProductSearchService } from '../catalog/products/product-search.service.js';
import { StockService } from '../inventory/stock.service.js';
import { PromotionsService } from '../promotions/promotions.service.js';
import { StoreSettingsService } from '../settings/store-settings.service.js';
import type {
  StoreCategoryDto,
  StoreProductDetailDto,
  StoreProductDto,
  StoreProductPageDto,
  StoreProductsQueryDto,
  StoreRefDto,
} from './dto/storefront.dto.js';
import {
  availabilityOf,
  maxPurchasable,
  visibleProductWhere,
} from './sale-rules.js';

const ref = { select: { id: true, name: true, slug: true } } as const;

const cardInclude = {
  category: { select: { isActive: true, deletedAt: true } },
  brand: ref,
  presentation: { select: { name: true } },
  concentration: { select: { name: true } },
  images: { where: { isPrimary: true }, select: { fileId: true } },
} satisfies Prisma.ProductInclude;

const detailInclude = {
  ...cardInclude,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      deletedAt: true,
    },
  },
  subcategory: ref,
  manufacturer: { select: { name: true } },
  activeIngredients: {
    orderBy: { sortOrder: 'asc' },
    select: { activeIngredient: { select: { name: true } } },
  },
  images: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { fileId: true, altText: true, isPrimary: true },
  },
} satisfies Prisma.ProductInclude;

type CardRow = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

const ORDER_BY: Record<
  StoreProductsQueryDto['sort'],
  Prisma.ProductOrderByWithRelationInput[]
> = {
  name: [{ name: 'asc' }, { id: 'asc' }],
  price_asc: [{ price: 'asc' }, { name: 'asc' }],
  price_desc: [{ price: 'desc' }, { name: 'asc' }],
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
};

/**
 * Catálogo público de la tienda. Muestra los productos activos de categorías
 * activas; los que requieren receta aparecen como informativos (D2). No hace
 * recomendaciones ni sugiere sustitutos.
 */
@Injectable()
export class StorefrontService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: ProductSearchService,
    private readonly stock: StockService,
    private readonly settings: StoreSettingsService,
    private readonly promotions: PromotionsService,
  ) {}

  async categories(): Promise<StoreCategoryDto[]> {
    const categories = await this.prisma.category.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        subcategories: {
          where: { deletedAt: null, isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: {
            products: { where: { deletedAt: null, isActive: true } },
          },
        },
      },
    });
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageFileId: c.imageFileId,
      productCount: c._count.products,
      subcategories: c.subcategories,
    }));
  }

  async products(query: StoreProductsQueryDto): Promise<StoreProductPageDto> {
    const empty = {
      items: [],
      total: 0,
      page: query.page,
      pageSize: query.pageSize,
      brands: [],
    };
    const where: Prisma.ProductWhereInput = { ...visibleProductWhere };
    if (query.category) {
      const category = await this.prisma.category.findFirst({
        where: { slug: query.category, deletedAt: null, isActive: true },
      });
      if (!category) return empty;
      where.categoryId = category.id;
      if (query.subcategory) {
        const sub = await this.prisma.subcategory.findFirst({
          where: {
            slug: query.subcategory,
            categoryId: category.id,
            deletedAt: null,
            isActive: true,
          },
        });
        if (!sub) return empty;
        where.subcategoryId = sub.id;
      }
    }
    if (query.search) {
      const ids = await this.search.matchingIds(query.search);
      if (ids.length === 0) return empty;
      where.id = { in: ids };
    }
    const brandWhere: Prisma.ProductWhereInput = query.brand
      ? { ...where, brand: { slug: query.brand, deletedAt: null } }
      : where;

    const [rows, total, brands] = await Promise.all([
      this.prisma.product.findMany({
        where: brandWhere,
        include: cardInclude,
        orderBy: ORDER_BY[query.sort],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where: brandWhere }),
      this.brandsFor(where),
    ]);
    return {
      items: await this.toCards(rows),
      total,
      page: query.page,
      pageSize: query.pageSize,
      brands,
    };
  }

  async product(slug: string): Promise<StoreProductDetailDto> {
    const product = await this.prisma.product.findFirst({
      where: { slug, ...visibleProductWhere },
      include: detailInclude,
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    const primary = product.images.find((i) => i.isPrimary);
    const [card] = await this.toCards([
      { ...product, images: primary ? [{ fileId: primary.fileId }] : [] },
    ]);
    return {
      // toCards devuelve objetos planos; el tipo es una clase solo por Swagger.
      // oxlint-disable-next-line typescript/no-misused-spread
      ...card,
      description: product.description,
      category: {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug,
      },
      subcategory: product.subcategory,
      manufacturer: product.manufacturer?.name ?? null,
      activeIngredients: product.activeIngredients.map(
        (a) => a.activeIngredient.name,
      ),
      sanitaryRegistration: product.sanitaryRegistration,
      images: product.images.map((i) => ({
        fileId: i.fileId,
        altText: i.altText,
      })),
    };
  }

  private async brandsFor(
    where: Prisma.ProductWhereInput,
  ): Promise<StoreRefDto[]> {
    const groups = await this.prisma.product.groupBy({
      by: ['brandId'],
      where: { ...where, brandId: { not: null } },
    });
    const ids = groups.flatMap((g) => (g.brandId ? [g.brandId] : []));
    if (ids.length === 0) return [];
    return this.prisma.brand.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }

  private async toCards(rows: CardRow[]): Promise<StoreProductDto[]> {
    const [available, settings, promotions] = await Promise.all([
      this.stock.availableByProduct(rows.map((r) => r.id)),
      this.settings.row(),
      this.promotions.bestFor(rows),
    ]);
    return rows.map((p) => {
      const units = available.get(p.id) ?? 0;
      const promo = promotions.get(p.id);
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        shortDescription: p.shortDescription,
        price: p.price.toFixed(2),
        promotion: promo
          ? {
              name: promo.name,
              price: p.price.sub(promo.unitDiscount).toFixed(2),
              discount: promo.unitDiscount.toFixed(2),
              endsAt: promo.endsAt.toISOString(),
            }
          : null,
        brand: p.brand,
        presentation: p.presentation?.name ?? null,
        concentration: p.concentration?.name ?? null,
        saleCondition: p.saleCondition,
        availability: availabilityOf(p, units),
        maxQuantity: maxPurchasable(p, units, settings.maxUnitsPerProduct),
        primaryImageFileId: p.images[0]?.fileId ?? null,
      };
    });
  }
}
