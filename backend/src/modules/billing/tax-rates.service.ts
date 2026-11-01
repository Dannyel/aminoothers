import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal, type DecimalValue } from '../../common/utils/money.js';
import type { TaxRate } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  TaxRateAdminDto,
  TaxRateDto,
  TaxRateInputDto,
  UpdateTaxRateDto,
} from './dto/billing.dto.js';

/**
 * Tasas de impuesto. Los pedidos guardan la tasa que se aplicó, así que un
 * cambio solo afecta las ventas siguientes. Siempre hay una predeterminada
 * (índice único parcial) y no se desactiva una tasa en uso.
 */
@Injectable()
export class TaxRatesService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(): Promise<TaxRateDto[]> {
    const rates = await this.prisma.taxRate.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    return rates.map(toDto);
  }

  async listAll(): Promise<TaxRateAdminDto[]> {
    const rates = await this.prisma.taxRate.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: {
        _count: { select: { products: { where: { deletedAt: null } } } },
      },
    });
    return rates.map((r) => ({
      // toDto devuelve un objeto plano; el tipo es una clase solo por Swagger.
      // oxlint-disable-next-line typescript/no-misused-spread
      ...toDto(r),
      isActive: r.isActive,
      productCount: r._count.products,
    }));
  }

  async create(dto: TaxRateInputDto): Promise<TaxRateAdminDto> {
    if (await this.prisma.taxRate.findUnique({ where: { code: dto.code } })) {
      throw new ConflictException(
        `Ya existe una tasa con el código ${dto.code}`,
      );
    }
    const created = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault)
        await tx.taxRate.updateMany({ data: { isDefault: false } });
      return tx.taxRate.create({
        data: {
          code: dto.code,
          name: dto.name,
          rate: toRate(dto.ratePercent),
          isDefault: dto.isDefault ?? false,
        },
      });
    });
    return this.admin(created.id);
  }

  async update(id: string, dto: UpdateTaxRateDto): Promise<TaxRateAdminDto> {
    const current = await this.find(id);
    if (dto.isDefault === false && current.isDefault) {
      throw new ConflictException(
        'Elija otra tasa como predeterminada en lugar de quitarle esa condición a esta',
      );
    }
    if (dto.isActive === false) {
      if (current.isDefault || dto.isDefault) {
        throw new ConflictException(
          'La tasa predeterminada no se puede desactivar',
        );
      }
      const inUse = await this.prisma.product.count({
        where: { taxRateId: id, deletedAt: null },
      });
      if (inUse > 0) {
        throw new ConflictException(
          `La tasa la usan ${inUse} producto(s); asígneles otra antes de desactivarla`,
        );
      }
    }
    if (dto.isDefault && dto.isActive !== true && !current.isActive) {
      throw new ConflictException(
        'Active la tasa antes de hacerla predeterminada',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault && !current.isDefault) {
        await tx.taxRate.updateMany({ data: { isDefault: false } });
      }
      await tx.taxRate.update({
        where: { id },
        data: {
          name: dto.name,
          isActive: dto.isActive,
          ...(dto.isDefault ? { isDefault: true } : {}),
          ...(dto.ratePercent !== undefined
            ? { rate: toRate(dto.ratePercent) }
            : {}),
        },
      });
    });
    return this.admin(id);
  }

  private async admin(id: string): Promise<TaxRateAdminDto> {
    const found = (await this.listAll()).find((r) => r.id === id);
    if (!found) throw new NotFoundException('Tasa de impuesto no encontrada');
    return found;
  }

  private async find(id: string): Promise<TaxRate> {
    const rate = await this.prisma.taxRate.findUnique({ where: { id } });
    if (!rate) throw new NotFoundException('Tasa de impuesto no encontrada');
    return rate;
  }
}

/** "12.5" (porcentaje) → 0.1250 (proporción). */
function toRate(percent: string): DecimalValue {
  return new Decimal(percent).div(100).toDecimalPlaces(4);
}

function toDto(r: TaxRate): TaxRateDto {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    rate: r.rate.toFixed(4),
    isDefault: r.isDefault,
  };
}
