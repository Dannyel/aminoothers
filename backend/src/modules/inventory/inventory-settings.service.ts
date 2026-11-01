import { Injectable } from '@nestjs/common';
import { addDays, todayInBusinessZone } from '../../common/utils/dates.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  InventorySettingsDto,
  InventorySettingsResponseDto,
} from './dto/inventory.dto.js';

/** Fechas de corte del día, en la zona del negocio. */
export interface ExpiryWindow {
  /** Hoy: un lote con vencimiento anterior está vencido. */
  today: string;
  /** Los lotes que vencen antes de esta fecha no se venden. */
  sellableFrom: string;
  /** Hasta esta fecha (inclusive) el lote está "próximo a vencer". */
  nearExpiryUntil: string;
}

@Injectable()
export class InventorySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<InventorySettingsResponseDto> {
    const settings = await this.prisma.storeSettings.findUniqueOrThrow({
      where: { id: 1 },
    });
    return {
      minShelfLifeDaysForSale: settings.minShelfLifeDaysForSale,
      nearExpiryDays: settings.nearExpiryDays,
      updatedAt: settings.updatedAt.toISOString(),
    };
  }

  async update(
    actor: AuthUser,
    dto: InventorySettingsDto,
  ): Promise<InventorySettingsResponseDto> {
    await this.prisma.storeSettings.update({
      where: { id: 1 },
      data: {
        minShelfLifeDaysForSale: dto.minShelfLifeDaysForSale,
        nearExpiryDays: dto.nearExpiryDays,
        updatedById: actor.id,
      },
    });
    return this.get();
  }

  async window(now = new Date()): Promise<ExpiryWindow> {
    const { minShelfLifeDaysForSale, nearExpiryDays } = await this.get();
    const today = todayInBusinessZone(now);
    return {
      today,
      sellableFrom: addDays(today, minShelfLifeDaysForSale),
      nearExpiryUntil: addDays(today, nearExpiryDays),
    };
  }
}
