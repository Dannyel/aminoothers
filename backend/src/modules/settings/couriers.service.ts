import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Courier } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  CourierDto,
  CourierInputDto,
  UpdateCourierDto,
} from './dto/settings.dto.js';

const vigente = { deletedAt: null };

/**
 * Empresas de mensajería. El seguimiento es manual; `integrationCode` queda
 * para conectar la API del proveedor cuando se elija.
 */
@Injectable()
export class CouriersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<CourierDto[]> {
    const rows = await this.prisma.courier.findMany({
      where: vigente,
      orderBy: { name: 'asc' },
    });
    return rows.map(toCourierDto);
  }

  async create(dto: CourierInputDto): Promise<CourierDto> {
    return toCourierDto(await this.prisma.courier.create({ data: dto }));
  }

  async update(id: string, dto: UpdateCourierDto): Promise<CourierDto> {
    await this.find(id);
    return toCourierDto(
      await this.prisma.courier.update({ where: { id }, data: dto }),
    );
  }

  /** Baja lógica; no se permite mientras un método de envío activo la use. */
  async remove(id: string): Promise<void> {
    await this.find(id);
    const inUse = await this.prisma.shippingMethod.count({
      where: { courierId: id, deletedAt: null },
    });
    if (inUse > 0) {
      throw new ConflictException(
        'La mensajería está asignada a métodos de envío; cámbielos antes de darla de baja',
      );
    }
    await this.prisma.courier.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  private async find(id: string): Promise<Courier> {
    const courier = await this.prisma.courier.findFirst({
      where: { id, ...vigente },
    });
    if (!courier) throw new NotFoundException('Mensajería no encontrada');
    return courier;
  }
}

export function toCourierDto(c: Courier): CourierDto {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    website: c.website,
    trackingUrlTemplate: c.trackingUrlTemplate,
    isActive: c.isActive,
  };
}

/** URL de rastreo de una guía, o null si la mensajería no tiene plantilla. */
export function trackingUrl(
  template: string | null,
  trackingNumber: string | null,
): string | null {
  return template && trackingNumber
    ? template.replace('{tracking}', encodeURIComponent(trackingNumber))
    : null;
}
