import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../common/auth/auth-user.js';
import type { StoreSettings } from '../../generated/prisma/client.js';
import { FilePurpose } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { recordChanges } from '../audit/audit-trail.js';
import { FilesService, type UploadedContent } from '../files/files.service.js';
import type {
  PublicStoreInfoDto,
  StoreSettingsDto,
  UpdateStoreSettingsDto,
} from './dto/settings.dto.js';

/** Datos de la farmacia y parámetros de pedidos (fila única de store_settings). */
@Injectable()
export class StoreSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  /** Fila completa, para uso interno de otros módulos (pedidos, carrito). */
  row(): Promise<StoreSettings> {
    return this.prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } });
  }

  async publicInfo(): Promise<PublicStoreInfoDto> {
    return toPublic(await this.row());
  }

  async get(): Promise<StoreSettingsDto> {
    return toDto(await this.row());
  }

  async update(
    actor: AuthUser,
    dto: UpdateStoreSettingsDto,
  ): Promise<StoreSettingsDto> {
    const before = await this.prisma.storeSettings.findUniqueOrThrow({
      where: { id: 1 },
    });
    const updated = await this.prisma.storeSettings.update({
      where: { id: 1 },
      // dto es un objeto plano validado; solo trae campos de store_settings.
      // oxlint-disable-next-line typescript/no-misused-spread
      data: { ...dto, updatedById: actor.id },
    });
    recordChanges(before, updated);
    return toDto(updated);
  }

  /** Reemplaza el logotipo; el anterior se borra del almacenamiento. */
  async setLogo(
    actor: AuthUser,
    upload: UploadedContent | undefined,
  ): Promise<StoreSettingsDto> {
    const previous = await this.currentLogo();
    const file = await this.files.saveImage(upload, FilePurpose.LOGO, actor.id);
    let updated: StoreSettings;
    try {
      updated = await this.prisma.storeSettings.update({
        where: { id: 1 },
        data: { logoFileId: file.id, updatedById: actor.id },
      });
    } catch (error) {
      await this.files.remove(file);
      throw error;
    }
    if (previous) await this.files.remove(previous);
    return toDto(updated);
  }

  async removeLogo(actor: AuthUser): Promise<StoreSettingsDto> {
    const previous = await this.currentLogo();
    const updated = await this.prisma.storeSettings.update({
      where: { id: 1 },
      data: { logoFileId: null, updatedById: actor.id },
    });
    if (previous) await this.files.remove(previous);
    return toDto(updated);
  }

  private async currentLogo() {
    const settings = await this.prisma.storeSettings.findUniqueOrThrow({
      where: { id: 1 },
      select: { logo: { select: { id: true, storageKey: true } } },
    });
    return settings.logo;
  }
}

function toPublic(s: StoreSettings): PublicStoreInfoDto {
  return {
    tradeName: s.tradeName,
    legalName: s.legalName,
    taxId: s.taxId,
    fiscalAddress: s.fiscalAddress,
    phone: s.phone,
    whatsapp: s.whatsapp,
    email: s.email,
    businessHours: s.businessHours,
    logoFileId: s.logoFileId,
    sanitaryLicense: s.sanitaryLicense,
    regentName: s.regentName,
    regulatoryNotice: s.regulatoryNotice,
  };
}

function toDto(s: StoreSettings): StoreSettingsDto {
  return {
    // toPublic devuelve un objeto plano; el tipo es una clase solo por Swagger.
    // oxlint-disable-next-line typescript/no-misused-spread
    ...toPublic(s),
    transferReservationHours: s.transferReservationHours,
    codReservationHours: s.codReservationHours,
    maxUnitsPerProduct: s.maxUnitsPerProduct,
    returnWindowDays: s.returnWindowDays,
    staffAlertEmail: s.staffAlertEmail,
    updatedAt: s.updatedAt.toISOString(),
  };
}
