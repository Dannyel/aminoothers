import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { paginationArgs } from '../../common/dto/pagination.dto.js';
import type { Prisma, Supplier } from '../../generated/prisma/client.js';
import { PurchaseOrderStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  ListSuppliersQueryDto,
  SupplierDto,
  SupplierInputDto,
  SupplierPageDto,
  UpdateSupplierDto,
} from './dto/purchasing.dto.js';

const OPEN_STATUSES = [
  PurchaseOrderStatus.DRAFT,
  PurchaseOrderStatus.APPROVED,
  PurchaseOrderStatus.PARTIALLY_RECEIVED,
];

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListSuppliersQueryDto): Promise<SupplierPageDto> {
    const where: Prisma.SupplierWhereInput = {
      deletedAt: null,
      ...(query.status === 'all'
        ? {}
        : { isActive: query.status === 'active' }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { taxId: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        include: { _count: { select: { purchaseOrders: true } } },
        orderBy: { name: 'asc' },
        ...paginationArgs(query),
      }),
      this.prisma.supplier.count({ where }),
    ]);
    return {
      items: rows.map(toDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<SupplierDto> {
    return toDto(await this.find(id));
  }

  async create(dto: SupplierInputDto): Promise<SupplierDto> {
    const supplier = await this.prisma.supplier.create({
      data: fields(dto),
      include: { _count: { select: { purchaseOrders: true } } },
    });
    return toDto(supplier);
  }

  async update(id: string, dto: UpdateSupplierDto): Promise<SupplierDto> {
    await this.find(id);
    const supplier = await this.prisma.supplier.update({
      where: { id },
      data: { ...fields(dto), isActive: dto.isActive },
      include: { _count: { select: { purchaseOrders: true } } },
    });
    return toDto(supplier);
  }

  /** Baja lógica; no se permite con órdenes abiertas. */
  async remove(id: string): Promise<void> {
    await this.find(id);
    const open = await this.prisma.purchaseOrder.count({
      where: { supplierId: id, status: { in: OPEN_STATUSES } },
    });
    if (open > 0) {
      throw new ConflictException(
        `El proveedor tiene ${open} orden(es) de compra abiertas; ciérrelas o cancélelas primero.`,
      );
    }
    await this.prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  private async find(id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { purchaseOrders: true } } },
    });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');
    return supplier;
  }
}

function fields(dto: SupplierInputDto) {
  return {
    name: dto.name,
    taxId: dto.taxId,
    contactName: dto.contactName,
    phone: dto.phone,
    email: dto.email,
    address: dto.address,
    notes: dto.notes,
  };
}

function toDto(
  supplier: Supplier & { _count: { purchaseOrders: number } },
): SupplierDto {
  return {
    id: supplier.id,
    name: supplier.name,
    taxId: supplier.taxId,
    contactName: supplier.contactName,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
    notes: supplier.notes,
    isActive: supplier.isActive,
    purchaseOrderCount: supplier._count.purchaseOrders,
  };
}
