import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../../common/auth/auth-user.js';
import { slugify } from '../../../common/utils/slug.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { FilePurpose } from '../../../generated/prisma/enums.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import {
  FilesService,
  type UploadedContent,
} from '../../files/files.service.js';
import type {
  CategoryDto,
  CreateCategoryDto,
  CreateSubcategoryDto,
  SubcategoryDto,
  UpdateCategoryDto,
  UpdateSubcategoryDto,
} from './categories.dto.js';

const vigentes = { deletedAt: null };

const categoryInclude = {
  subcategories: {
    where: vigentes,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { products: { where: vigentes } } } },
  },
  _count: { select: { products: { where: vigentes } } },
} satisfies Prisma.CategoryInclude;

type CategoryRow = Prisma.CategoryGetPayload<{
  include: typeof categoryInclude;
}>;

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  async list(): Promise<CategoryDto[]> {
    const categories = await this.prisma.category.findMany({
      where: vigentes,
      include: categoryInclude,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return categories.map(toDto);
  }

  async get(id: string): Promise<CategoryDto> {
    return toDto(await this.find(id));
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDto> {
    const slug = await this.uniqueCategorySlug(dto.name);
    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder,
        slug,
      },
      include: categoryInclude,
    });
    return toDto(category);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    await this.find(id);
    const slug =
      dto.name === undefined
        ? undefined
        : await this.uniqueCategorySlug(dto.name, id);
    const category = await this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        slug,
      },
      include: categoryInclude,
    });
    return toDto(category);
  }

  async remove(id: string): Promise<void> {
    const category = await this.find(id);
    if (category._count.products > 0) {
      throw new ConflictException(
        `La categoría tiene ${category._count.products} producto(s). Desactívela o mueva los productos.`,
      );
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.subcategory.updateMany({
        where: { categoryId: id, deletedAt: null },
        data: { deletedAt: now, isActive: false },
      }),
      this.prisma.category.update({
        where: { id },
        data: { deletedAt: now, isActive: false },
      }),
    ]);
  }

  /** Reemplaza la imagen de la categoría; la anterior se elimina. */
  async setImage(
    actor: AuthUser,
    id: string,
    upload?: UploadedContent,
  ): Promise<CategoryDto> {
    const category = await this.find(id);
    const file = await this.files.saveImage(
      upload,
      FilePurpose.CATEGORY_IMAGE,
      actor.id,
    );
    await this.prisma.category.update({
      where: { id },
      data: { imageFileId: file.id },
    });
    await this.removeImageFile(category.imageFileId);
    return this.get(id);
  }

  async removeImage(id: string): Promise<CategoryDto> {
    const category = await this.find(id);
    await this.prisma.category.update({
      where: { id },
      data: { imageFileId: null },
    });
    await this.removeImageFile(category.imageFileId);
    return this.get(id);
  }

  // ─── Subcategorías ─────────────────────────────────────────────────────────

  async createSubcategory(
    categoryId: string,
    dto: CreateSubcategoryDto,
  ): Promise<SubcategoryDto> {
    await this.find(categoryId);
    const slug = await this.uniqueSubcategorySlug(categoryId, dto.name);
    const sub = await this.prisma.subcategory.create({
      data: { name: dto.name, sortOrder: dto.sortOrder, categoryId, slug },
      include: categoryInclude.subcategories.include,
    });
    return toSubDto(sub);
  }

  async updateSubcategory(
    id: string,
    dto: UpdateSubcategoryDto,
  ): Promise<SubcategoryDto> {
    const current = await this.findSub(id);
    const slug =
      dto.name === undefined
        ? undefined
        : await this.uniqueSubcategorySlug(current.categoryId, dto.name, id);
    const sub = await this.prisma.subcategory.update({
      where: { id },
      data: {
        name: dto.name,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        slug,
      },
      include: categoryInclude.subcategories.include,
    });
    return toSubDto(sub);
  }

  async removeSubcategory(id: string): Promise<void> {
    await this.findSub(id);
    const inUse = await this.prisma.product.count({
      where: { subcategoryId: id, ...vigentes },
    });
    if (inUse > 0) {
      throw new ConflictException(
        `La subcategoría tiene ${inUse} producto(s). Desactívela o mueva los productos.`,
      );
    }
    await this.prisma.subcategory.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // ─── Internos ──────────────────────────────────────────────────────────────

  private async find(id: string): Promise<CategoryRow> {
    const category = await this.prisma.category.findFirst({
      where: { id, ...vigentes },
      include: categoryInclude,
    });
    if (!category) throw new NotFoundException('Categoría no encontrada');
    return category;
  }

  private async findSub(id: string) {
    const sub = await this.prisma.subcategory.findFirst({
      where: { id, ...vigentes },
    });
    if (!sub) throw new NotFoundException('Subcategoría no encontrada');
    return sub;
  }

  private async uniqueCategorySlug(
    name: string,
    exceptId?: string,
  ): Promise<string> {
    const slug = slugify(name);
    const clash = await this.prisma.category.findFirst({
      where: {
        slug,
        ...vigentes,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
    if (clash)
      throw new ConflictException(`Ya existe la categoría "${clash.name}"`);
    return slug;
  }

  private async uniqueSubcategorySlug(
    categoryId: string,
    name: string,
    exceptId?: string,
  ): Promise<string> {
    const slug = slugify(name);
    const clash = await this.prisma.subcategory.findFirst({
      where: {
        categoryId,
        slug,
        ...vigentes,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
    if (clash)
      throw new ConflictException(`Ya existe la subcategoría "${clash.name}"`);
    return slug;
  }

  private async removeImageFile(fileId: string | null): Promise<void> {
    if (!fileId) return;
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (file) await this.files.remove(file);
  }
}

function toSubDto(sub: CategoryRow['subcategories'][number]): SubcategoryDto {
  return {
    id: sub.id,
    categoryId: sub.categoryId,
    name: sub.name,
    slug: sub.slug,
    sortOrder: sub.sortOrder,
    isActive: sub.isActive,
    productCount: sub._count.products,
  };
}

function toDto(category: CategoryRow): CategoryDto {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    imageFileId: category.imageFileId,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    productCount: category._count.products,
    subcategories: category.subcategories.map(toSubDto),
  };
}
