import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  paginationArgs,
  type Paginated,
} from '../../../common/dto/pagination.dto.js';
import { slugify } from '../../../common/utils/slug.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type {
  CatalogOptionDto,
  CreateSimpleCatalogItemDto,
  SimpleCatalogItemDto,
  SimpleCatalogKind,
  SimpleCatalogListQueryDto,
  UpdateSimpleCatalogItemDto,
} from './simple-catalog.dto.js';

interface Row {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

/**
 * Subconjunto común de los delegados de Prisma de los catálogos simples: las
 * seis tablas tienen la misma forma (nombre, slug, estado, baja lógica).
 */
interface SimpleDelegate {
  findMany(args: object): Promise<Row[]>;
  findFirst(args: object): Promise<Row | null>;
  count(args: object): Promise<number>;
  create(args: object): Promise<Row>;
  update(args: object): Promise<Row>;
}

/** Productos vigentes que usan cada elemento, según la relación de cada catálogo. */
type UsageFilter = (id: string) => object;

const LABELS: Record<SimpleCatalogKind, string> = {
  brands: 'La marca',
  manufacturers: 'El fabricante',
  presentations: 'La presentación',
  concentrations: 'La concentración',
  'active-ingredients': 'El principio activo',
  tags: 'La etiqueta',
};

const notDeletedProduct = { deletedAt: null };

const USAGE: Record<SimpleCatalogKind, UsageFilter> = {
  brands: (id) => ({ brandId: id, ...notDeletedProduct }),
  manufacturers: (id) => ({ manufacturerId: id, ...notDeletedProduct }),
  presentations: (id) => ({ presentationId: id, ...notDeletedProduct }),
  concentrations: (id) => ({ concentrationId: id, ...notDeletedProduct }),
  'active-ingredients': (id) => ({
    activeIngredients: { some: { activeIngredientId: id } },
    ...notDeletedProduct,
  }),
  tags: (id) => ({ tags: { some: { tagId: id } }, ...notDeletedProduct }),
};

/**
 * Marcas, fabricantes, presentaciones, concentraciones, principios activos y
 * etiquetas. La baja es lógica y solo se permite si ningún producto vigente
 * usa el elemento; si no, se debe desactivar.
 */
@Injectable()
export class SimpleCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    kind: SimpleCatalogKind,
    query: SimpleCatalogListQueryDto,
  ): Promise<Paginated<SimpleCatalogItemDto>> {
    const where = {
      deletedAt: null,
      ...(query.status === 'all'
        ? {}
        : { isActive: query.status === 'active' }),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const delegate = this.delegate(kind);
    const [rows, total] = await Promise.all([
      delegate.findMany({
        where,
        orderBy: { name: 'asc' },
        ...paginationArgs(query),
      }),
      delegate.count({ where }),
    ]);
    const items = await Promise.all(rows.map((row) => this.toDto(kind, row)));
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /** Todos los elementos activos, para los selectores del formulario de producto. */
  options(kind: SimpleCatalogKind): Promise<CatalogOptionDto[]> {
    return this.delegate(kind).findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  async create(
    kind: SimpleCatalogKind,
    dto: CreateSimpleCatalogItemDto,
  ): Promise<SimpleCatalogItemDto> {
    const slug = await this.uniqueSlug(kind, dto.name);
    const row = await this.delegate(kind).create({
      data: { name: dto.name, slug },
    });
    return this.toDto(kind, row);
  }

  async update(
    kind: SimpleCatalogKind,
    id: string,
    dto: UpdateSimpleCatalogItemDto,
  ): Promise<SimpleCatalogItemDto> {
    await this.find(kind, id);
    const data: Partial<Row> = { isActive: dto.isActive };
    if (dto.name !== undefined) {
      data.name = dto.name;
      data.slug = await this.uniqueSlug(kind, dto.name, id);
    }
    const row = await this.delegate(kind).update({ where: { id }, data });
    return this.toDto(kind, row);
  }

  async remove(kind: SimpleCatalogKind, id: string): Promise<void> {
    await this.find(kind, id);
    const inUse = await this.prisma.product.count({ where: USAGE[kind](id) });
    if (inUse > 0) {
      throw new ConflictException(
        `${LABELS[kind]} está asignado a ${inUse} producto(s). Desactívelo en lugar de eliminarlo.`,
      );
    }
    await this.delegate(kind).update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  /** Verifica que un id exista, no esté dado de baja y esté activo (para asignarlo). */
  async assertAssignable(
    kind: SimpleCatalogKind,
    ids: string[],
  ): Promise<void> {
    if (ids.length === 0) return;
    const found = await this.delegate(kind).count({
      where: { id: { in: ids }, deletedAt: null, isActive: true },
    });
    if (found !== new Set(ids).size) {
      throw new NotFoundException(
        `${LABELS[kind]} indicado no existe o está inactivo`,
      );
    }
  }

  private async find(kind: SimpleCatalogKind, id: string): Promise<Row> {
    const row = await this.delegate(kind).findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) throw new NotFoundException(`${LABELS[kind]} no existe`);
    return row;
  }

  private async uniqueSlug(
    kind: SimpleCatalogKind,
    name: string,
    exceptId?: string,
  ) {
    const slug = slugify(name);
    const clash = await this.delegate(kind).findFirst({
      where: {
        slug,
        deletedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
    if (clash) throw new ConflictException(`Ya existe "${clash.name}"`);
    return slug;
  }

  private async toDto(
    kind: SimpleCatalogKind,
    row: Row,
  ): Promise<SimpleCatalogItemDto> {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      isActive: row.isActive,
      productCount: await this.prisma.product.count({
        where: USAGE[kind](row.id),
      }),
    };
  }

  private delegate(kind: SimpleCatalogKind): SimpleDelegate {
    const delegates = {
      brands: this.prisma.brand,
      manufacturers: this.prisma.manufacturer,
      presentations: this.prisma.presentation,
      concentrations: this.prisma.concentration,
      'active-ingredients': this.prisma.activeIngredient,
      tags: this.prisma.tag,
    } as const;
    return delegates[kind] as unknown as SimpleDelegate;
  }
}
