import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ShippingMethod } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  ShippingMethodDto,
  ShippingMethodInputDto,
  UpdateShippingMethodDto,
} from './dto/settings.dto.js';

const vigente = { deletedAt: null };
const order = [{ sortOrder: 'asc' }, { name: 'asc' }] as const;

/** Tipos de envío con tarifa fija (D5). Las mensajerías se asocian en la Fase 7. */
@Injectable()
export class ShippingMethodsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<ShippingMethodDto[]> {
    const rows = await this.prisma.shippingMethod.findMany({
      where: vigente,
      orderBy: [...order],
    });
    return rows.map(toShippingMethodDto);
  }

  /** Los que puede elegir el cliente. */
  async listActive(): Promise<ShippingMethodDto[]> {
    const rows = await this.prisma.shippingMethod.findMany({
      where: { ...vigente, isActive: true },
      orderBy: [...order],
    });
    return rows.map(toShippingMethodDto);
  }

  /** Método vigente y activo, o null (para el carrito y el checkout). */
  findActive(id: string): Promise<ShippingMethod | null> {
    return this.prisma.shippingMethod.findFirst({
      where: { id, ...vigente, isActive: true },
    });
  }

  async create(dto: ShippingMethodInputDto): Promise<ShippingMethodDto> {
    assertDays(dto.estimatedDaysMin, dto.estimatedDaysMax);
    await this.assertCourier(dto.courierId);
    return toShippingMethodDto(
      await this.prisma.shippingMethod.create({ data: dto }),
    );
  }

  async update(
    id: string,
    dto: UpdateShippingMethodDto,
  ): Promise<ShippingMethodDto> {
    const current = await this.find(id);
    await this.assertCourier(dto.courierId);
    assertDays(
      dto.estimatedDaysMin === undefined
        ? current.estimatedDaysMin
        : dto.estimatedDaysMin,
      dto.estimatedDaysMax === undefined
        ? current.estimatedDaysMax
        : dto.estimatedDaysMax,
    );
    return toShippingMethodDto(
      await this.prisma.shippingMethod.update({ where: { id }, data: dto }),
    );
  }

  /** Baja lógica: los pedidos conservan el nombre y el costo que pagaron. */
  async remove(id: string): Promise<void> {
    await this.find(id);
    await this.prisma.shippingMethod.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  private async assertCourier(id: string | null | undefined): Promise<void> {
    if (!id) return;
    const courier = await this.prisma.courier.findFirst({
      where: { id, deletedAt: null, isActive: true },
    });
    if (!courier)
      throw new NotFoundException('La mensajería no existe o está inactiva');
  }

  private async find(id: string): Promise<ShippingMethod> {
    const method = await this.prisma.shippingMethod.findFirst({
      where: { id, ...vigente },
    });
    if (!method) throw new NotFoundException('Método de envío no encontrado');
    return method;
  }
}

function assertDays(min?: number | null, max?: number | null): void {
  if (min != null && max != null && max < min) {
    throw new BadRequestException(
      'El plazo máximo de entrega no puede ser menor que el mínimo',
    );
  }
}

export function toShippingMethodDto(m: ShippingMethod): ShippingMethodDto {
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    cost: m.cost.toFixed(2),
    estimatedDaysMin: m.estimatedDaysMin,
    estimatedDaysMax: m.estimatedDaysMax,
    coverageNote: m.coverageNote,
    allowsCashOnDelivery: m.allowsCashOnDelivery,
    courierId: m.courierId,
    isActive: m.isActive,
    sortOrder: m.sortOrder,
  };
}
