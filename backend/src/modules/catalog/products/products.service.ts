import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../../common/auth/auth-user.js';
import {
  paginationArgs,
  type Paginated,
} from '../../../common/dto/pagination.dto.js';
import { slugify } from '../../../common/utils/slug.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { FilePurpose, SaleCondition } from '../../../generated/prisma/enums.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { recordChanges } from '../../audit/audit-trail.js';
import {
  FilesService,
  type UploadedContent,
} from '../../files/files.service.js';
import { SimpleCatalogService } from '../simple/simple-catalog.service.js';
import type {
  CreateProductDto,
  ListProductsQueryDto,
  ProductDetailDto,
  ProductListItemDto,
  ProductOptionDto,
  UpdateProductDto,
  UpdateProductImageDto,
} from './dto/products.dto.js';
import { ProductSearchService } from './product-search.service.js';

export const MAX_IMAGES_PER_PRODUCT = 8;

const named = { select: { id: true, name: true } } as const;

const listInclude = {
  category: named,
  brand: named,
  presentation: named,
  concentration: named,
  images: { where: { isPrimary: true }, select: { fileId: true } },
} satisfies Prisma.ProductInclude;

const detailInclude = {
  ...listInclude,
  subcategory: named,
  manufacturer: named,
  taxRate: { select: { id: true, code: true, rate: true } },
  activeIngredients: {
    orderBy: { sortOrder: 'asc' },
    select: { activeIngredient: named },
  },
  tags: { select: { tag: named } },
  images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
} satisfies Prisma.ProductInclude;

type ListRow = Prisma.ProductGetPayload<{ include: typeof listInclude }>;
type DetailRow = Prisma.ProductGetPayload<{ include: typeof detailInclude }>;
type Tx = Prisma.TransactionClient;

const vigente = { deletedAt: null };

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: ProductSearchService,
    private readonly catalogs: SimpleCatalogService,
    private readonly files: FilesService,
  ) {}

  // ─── Consulta ──────────────────────────────────────────────────────────────

  async list(
    query: ListProductsQueryDto,
  ): Promise<Paginated<ProductListItemDto>> {
    const where: Prisma.ProductWhereInput = {
      ...vigente,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.subcategoryId ? { subcategoryId: query.subcategoryId } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.activeIngredientId
        ? {
            activeIngredients: {
              some: { activeIngredientId: query.activeIngredientId },
            },
          }
        : {}),
      ...(query.saleCondition ? { saleCondition: query.saleCondition } : {}),
      ...(query.status === 'all'
        ? {}
        : { isActive: query.status === 'active' }),
      ...(query.onlineSale === 'all'
        ? {}
        : { onlineSaleEnabled: query.onlineSale === 'yes' }),
    };
    if (query.search)
      where.id = { in: await this.search.matchingIds(query.search) };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: listInclude,
        orderBy: [{ name: 'asc' }, { sku: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.product.count({ where }),
    ]);
    return {
      items: rows.map(toListItem),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Productos vigentes para selectores (órdenes de compra, inventario). */
  options(): Promise<ProductOptionDto[]> {
    return this.prisma.product.findMany({
      where: { ...vigente, isActive: true },
      select: { id: true, sku: true, name: true },
      orderBy: [{ name: 'asc' }, { sku: 'asc' }],
    });
  }

  async get(id: string): Promise<ProductDetailDto> {
    const product = await this.prisma.product.findFirst({
      where: { id, ...vigente },
      include: detailInclude,
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return this.toDetail(product);
  }

  // ─── Alta y edición ────────────────────────────────────────────────────────

  async create(dto: CreateProductDto): Promise<ProductDetailDto> {
    if (await this.prisma.product.findUnique({ where: { sku: dto.sku } })) {
      throw new ConflictException(
        `Ya existe un producto con el SKU ${dto.sku}`,
      );
    }
    await this.assertBarcodeFree(dto.barcode);
    await this.assertReferences(dto, dto.categoryId);
    const taxRateId = dto.taxRateId ?? (await this.defaultTaxRateId());

    const {
      activeIngredientIds = [],
      tagIds = [],
      sanitaryRegistrationExpiresAt,
      ...fields
    } = dto;
    const product = await this.prisma.product.create({
      data: {
        ...fields,
        taxRateId,
        slug: slugify(`${dto.name} ${dto.sku}`, 250),
        sanitaryRegistrationExpiresAt: toDate(sanitaryRegistrationExpiresAt),
        activeIngredients: {
          create: activeIngredientIds.map((activeIngredientId, sortOrder) => ({
            activeIngredientId,
            sortOrder,
          })),
        },
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
    return this.get(product.id);
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductDetailDto> {
    const current = await this.findRow(id);
    const categoryId = dto.categoryId ?? current.categoryId;
    if (dto.barcode !== undefined)
      await this.assertBarcodeFree(dto.barcode, id);
    // Si cambia la categoría sin indicar subcategoría, la anterior deja de valer.
    const subcategoryId =
      dto.subcategoryId !== undefined
        ? dto.subcategoryId
        : dto.categoryId && dto.categoryId !== current.categoryId
          ? null
          : undefined;
    // dto es un objeto plano validado; la copia solo reemplaza subcategoryId.
    // oxlint-disable-next-line typescript/no-misused-spread
    await this.assertReferences({ ...dto, subcategoryId }, categoryId);

    const {
      activeIngredientIds,
      tagIds,
      sanitaryRegistrationExpiresAt,
      ...fields
    } = dto;
    // Sin receta de por medio la venta en línea deja de ser válida (D2).
    const leavesOtc =
      dto.saleCondition !== undefined &&
      dto.saleCondition !== SaleCondition.OTC;

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          ...fields,
          subcategoryId,
          sanitaryRegistrationExpiresAt:
            sanitaryRegistrationExpiresAt === undefined
              ? undefined
              : toDate(sanitaryRegistrationExpiresAt),
          ...(leavesOtc || dto.isActive === false ? disabledOnlineSale : {}),
        },
      });
      // Precio, condición de venta, estado, etc.: valor anterior y nuevo.
      recordChanges(current, updated);
      if (activeIngredientIds) {
        await tx.productActiveIngredient.deleteMany({
          where: { productId: id },
        });
        await tx.productActiveIngredient.createMany({
          data: activeIngredientIds.map((activeIngredientId, sortOrder) => ({
            productId: id,
            activeIngredientId,
            sortOrder,
          })),
        });
      }
      if (tagIds) {
        await tx.productTag.deleteMany({ where: { productId: id } });
        await tx.productTag.createMany({
          data: tagIds.map((tagId) => ({ productId: id, tagId })),
        });
      }
    });
    return this.get(id);
  }

  /**
   * Habilita o deshabilita la venta en línea. Es la verificación regulatoria
   * del producto: queda registrado quién y cuándo la aprobó.
   */
  async setOnlineSale(
    actor: AuthUser,
    id: string,
    enabled: boolean,
  ): Promise<ProductDetailDto> {
    const product = await this.findRow(id);
    if (enabled) {
      if (!product.isActive) {
        throw new BadRequestException(
          'Active el producto antes de habilitar su venta en línea',
        );
      }
      if (product.saleCondition !== SaleCondition.OTC) {
        throw new BadRequestException(
          'En esta versión solo se venden en línea productos de venta libre. Los que requieren receta o son controlados se muestran como venta en farmacia.',
        );
      }
    }
    await this.prisma.product.update({
      where: { id },
      data: enabled
        ? {
            onlineSaleEnabled: true,
            onlineSaleApprovedById: actor.id,
            onlineSaleApprovedAt: new Date(),
          }
        : disabledOnlineSale,
    });
    return this.get(id);
  }

  /** Baja lógica: los pedidos conservan su propia copia de los datos del producto. */
  async remove(id: string): Promise<void> {
    await this.findRow(id);
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, ...disabledOnlineSale },
    });
  }

  // ─── Imágenes ──────────────────────────────────────────────────────────────

  async addImage(
    actor: AuthUser,
    id: string,
    upload: UploadedContent | undefined,
    altText?: string,
  ): Promise<ProductDetailDto> {
    await this.findRow(id);
    const count = await this.prisma.productImage.count({
      where: { productId: id },
    });
    if (count >= MAX_IMAGES_PER_PRODUCT) {
      throw new BadRequestException(
        `Cada producto admite hasta ${MAX_IMAGES_PER_PRODUCT} imágenes`,
      );
    }
    const file = await this.files.saveImage(
      upload,
      FilePurpose.PRODUCT_IMAGE,
      actor.id,
    );
    try {
      await this.prisma.productImage.create({
        data: {
          productId: id,
          fileId: file.id,
          altText: altText?.trim().slice(0, 200) || null,
          sortOrder: count,
          isPrimary: count === 0,
        },
      });
    } catch (error) {
      await this.files.remove(file);
      throw error;
    }
    return this.get(id);
  }

  async updateImage(
    id: string,
    imageId: string,
    dto: UpdateProductImageDto,
  ): Promise<ProductDetailDto> {
    await this.findImage(id, imageId);
    await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.productImage.updateMany({
          where: { productId: id, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      await tx.productImage.update({
        where: { id: imageId },
        data: { altText: dto.altText, isPrimary: dto.isPrimary },
      });
    });
    return this.get(id);
  }

  async reorderImages(
    id: string,
    imageIds: string[],
  ): Promise<ProductDetailDto> {
    await this.findRow(id);
    const images = await this.prisma.productImage.findMany({
      where: { productId: id },
      select: { id: true },
    });
    const current = new Set(images.map((i) => i.id));
    if (
      images.length !== imageIds.length ||
      !imageIds.every((i) => current.has(i))
    ) {
      throw new BadRequestException(
        'Envíe todas las imágenes del producto en el nuevo orden',
      );
    }
    await this.prisma.$transaction(
      imageIds.map((imageId, sortOrder) =>
        this.prisma.productImage.update({
          where: { id: imageId },
          data: { sortOrder },
        }),
      ),
    );
    return this.get(id);
  }

  async removeImage(id: string, imageId: string): Promise<ProductDetailDto> {
    const image = await this.findImage(id, imageId);
    await this.prisma.$transaction(async (tx) => {
      await tx.productImage.delete({ where: { id: imageId } });
      if (image.isPrimary) await this.promoteFirstImage(tx, id);
    });
    await this.files.remove(image.file);
    return this.get(id);
  }

  // ─── Internos ──────────────────────────────────────────────────────────────

  private async findRow(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, ...vigente },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  private async findImage(productId: string, imageId: string) {
    await this.findRow(productId);
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
      include: { file: true },
    });
    if (!image) throw new NotFoundException('Imagen no encontrada');
    return image;
  }

  private async promoteFirstImage(tx: Tx, productId: string): Promise<void> {
    const next = await tx.productImage.findFirst({
      where: { productId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    if (next)
      await tx.productImage.update({
        where: { id: next.id },
        data: { isPrimary: true },
      });
  }

  private async assertBarcodeFree(
    barcode: string | null | undefined,
    exceptId?: string,
  ) {
    if (!barcode) return;
    const clash = await this.prisma.product.findFirst({
      where: {
        barcode,
        ...vigente,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
    if (clash) {
      throw new ConflictException(
        `El código de barras ya está asignado a ${clash.name} (${clash.sku})`,
      );
    }
  }

  /** Las referencias deben existir, estar vigentes y activas, y ser coherentes. */
  private async assertReferences(
    dto: Partial<CreateProductDto> & { subcategoryId?: string | null },
    categoryId: string,
  ): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, ...vigente, isActive: true },
    });
    if (!category)
      throw new NotFoundException('La categoría no existe o está inactiva');
    if (dto.subcategoryId) {
      const sub = await this.prisma.subcategory.findFirst({
        where: { id: dto.subcategoryId, ...vigente, isActive: true },
      });
      if (!sub)
        throw new NotFoundException(
          'La subcategoría no existe o está inactiva',
        );
      if (sub.categoryId !== categoryId) {
        throw new BadRequestException(
          'La subcategoría no pertenece a la categoría elegida',
        );
      }
    }
    const single = (value?: string | null) => (value ? [value] : []);
    await this.catalogs.assertAssignable('brands', single(dto.brandId));
    await this.catalogs.assertAssignable(
      'manufacturers',
      single(dto.manufacturerId),
    );
    await this.catalogs.assertAssignable(
      'presentations',
      single(dto.presentationId),
    );
    await this.catalogs.assertAssignable(
      'concentrations',
      single(dto.concentrationId),
    );
    await this.catalogs.assertAssignable(
      'active-ingredients',
      dto.activeIngredientIds ?? [],
    );
    await this.catalogs.assertAssignable('tags', dto.tagIds ?? []);
    if (dto.taxRateId) {
      const rate = await this.prisma.taxRate.findFirst({
        where: { id: dto.taxRateId, isActive: true },
      });
      if (!rate)
        throw new NotFoundException(
          'La tasa de impuesto no existe o está inactiva',
        );
    }
  }

  private async defaultTaxRateId(): Promise<string> {
    const rate = await this.prisma.taxRate.findFirst({
      where: { isDefault: true, isActive: true },
    });
    if (!rate)
      throw new BadRequestException(
        'No hay una tasa de impuesto predeterminada',
      );
    return rate.id;
  }

  private async toDetail(product: DetailRow): Promise<ProductDetailDto> {
    const approver = product.onlineSaleApprovedById
      ? await this.prisma.user.findUnique({
          where: { id: product.onlineSaleApprovedById },
          select: { id: true, firstName: true, lastName: true },
        })
      : null;
    const primary = product.images.find((i) => i.isPrimary);
    return {
      // toListItem devuelve un objeto plano; el tipo es una clase solo por Swagger.
      // oxlint-disable-next-line typescript/no-misused-spread
      ...toListItem({
        ...product,
        images: primary ? [{ fileId: primary.fileId }] : [],
      }),
      shortDescription: product.shortDescription,
      description: product.description,
      subcategory: product.subcategory,
      manufacturer: product.manufacturer,
      activeIngredients: product.activeIngredients.map(
        (a) => a.activeIngredient,
      ),
      tags: product.tags.map((t) => t.tag),
      sanitaryRegistration: product.sanitaryRegistration,
      sanitaryRegistrationExpiresAt:
        product.sanitaryRegistrationExpiresAt?.toISOString().slice(0, 10) ??
        null,
      taxRate: {
        id: product.taxRate.id,
        code: product.taxRate.code,
        rate: product.taxRate.rate.toFixed(4),
      },
      lowStockThreshold: product.lowStockThreshold,
      onlineSale: {
        enabled: product.onlineSaleEnabled,
        approvedAt: product.onlineSaleApprovedAt?.toISOString() ?? null,
        approvedBy: approver
          ? {
              id: approver.id,
              name: `${approver.firstName} ${approver.lastName}`,
            }
          : null,
      },
      images: product.images.map((i) => ({
        id: i.id,
        fileId: i.fileId,
        altText: i.altText,
        sortOrder: i.sortOrder,
        isPrimary: i.isPrimary,
      })),
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }
}

const disabledOnlineSale = {
  onlineSaleEnabled: false,
  onlineSaleApprovedById: null,
  onlineSaleApprovedAt: null,
} as const;

function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00Z`) : null;
}

function toListItem(product: ListRow): ProductListItemDto {
  return {
    id: product.id,
    sku: product.sku,
    barcode: product.barcode,
    name: product.name,
    slug: product.slug,
    price: product.price.toFixed(2),
    category: product.category,
    brand: product.brand,
    presentation: product.presentation,
    concentration: product.concentration,
    saleCondition: product.saleCondition,
    requiresPrescription: product.saleCondition !== SaleCondition.OTC,
    isActive: product.isActive,
    onlineSaleEnabled: product.onlineSaleEnabled,
    primaryImageFileId: product.images[0]?.fileId ?? null,
  };
}
