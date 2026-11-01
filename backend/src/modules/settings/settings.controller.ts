import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import {
  CurrentUser,
  Public,
  RequirePermissions,
  StaffOnly,
} from '../../common/decorators/auth.decorators.js';
import { ImageUpload } from '../catalog/image-upload.js';
import type { UploadedContent } from '../files/files.service.js';
import { PERMISSIONS } from '../roles/permissions.catalog.js';
import { BankAccountsService } from './bank-accounts.service.js';
import { CouriersService } from './couriers.service.js';
import {
  BankAccountDto,
  BankAccountInputDto,
  CourierDto,
  CourierInputDto,
  PublicStoreInfoDto,
  ShippingMethodDto,
  ShippingMethodInputDto,
  StoreSettingsDto,
  UpdateBankAccountDto,
  UpdateCourierDto,
  UpdateShippingMethodDto,
  UpdateStoreSettingsDto,
} from './dto/settings.dto.js';
import { ShippingMethodsService } from './shipping-methods.service.js';
import { StoreSettingsService } from './store-settings.service.js';

@ApiTags('Admin · Configuración')
@StaffOnly()
@Controller('admin')
export class AdminSettingsController {
  constructor(
    private readonly settings: StoreSettingsService,
    private readonly shipping: ShippingMethodsService,
    private readonly bankAccounts: BankAccountsService,
    private readonly couriers: CouriersService,
  ) {}

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Get('settings/store')
  getSettings(): Promise<StoreSettingsDto> {
    return this.settings.get();
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Patch('settings/store')
  updateSettings(
    @CurrentUser() actor: AuthUser,
    @Body() dto: UpdateStoreSettingsDto,
  ): Promise<StoreSettingsDto> {
    return this.settings.update(actor, dto);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ImageUpload()
  @Put('settings/store/logo')
  setLogo(
    @CurrentUser() actor: AuthUser,
    @UploadedFile() file?: UploadedContent,
  ): Promise<StoreSettingsDto> {
    return this.settings.setLogo(actor, file);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Delete('settings/store/logo')
  removeLogo(@CurrentUser() actor: AuthUser): Promise<StoreSettingsDto> {
    return this.settings.removeLogo(actor);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Get('shipping-methods')
  listShipping(): Promise<ShippingMethodDto[]> {
    return this.shipping.list();
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Post('shipping-methods')
  createShipping(
    @Body() dto: ShippingMethodInputDto,
  ): Promise<ShippingMethodDto> {
    return this.shipping.create(dto);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Patch('shipping-methods/:id')
  updateShipping(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShippingMethodDto,
  ): Promise<ShippingMethodDto> {
    return this.shipping.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('shipping-methods/:id')
  removeShipping(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.shipping.remove(id);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Get('bank-accounts')
  listBankAccounts(): Promise<BankAccountDto[]> {
    return this.bankAccounts.list();
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Post('bank-accounts')
  createBankAccount(@Body() dto: BankAccountInputDto): Promise<BankAccountDto> {
    return this.bankAccounts.create(dto);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Patch('bank-accounts/:id')
  updateBankAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBankAccountDto,
  ): Promise<BankAccountDto> {
    return this.bankAccounts.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('bank-accounts/:id')
  removeBankAccount(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.bankAccounts.remove(id);
  }

  /** Mensajerías: las consulta también quien despacha pedidos. */
  @RequirePermissions(PERMISSIONS.ORDERS_READ)
  @Get('couriers')
  listCouriers(): Promise<CourierDto[]> {
    return this.couriers.list();
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Post('couriers')
  createCourier(@Body() dto: CourierInputDto): Promise<CourierDto> {
    return this.couriers.create(dto);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Patch('couriers/:id')
  updateCourier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourierDto,
  ): Promise<CourierDto> {
    return this.couriers.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('couriers/:id')
  removeCourier(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.couriers.remove(id);
  }
}

@ApiTags('Tienda · Farmacia')
@Public()
@Controller('store')
export class StoreInfoController {
  constructor(
    private readonly settings: StoreSettingsService,
    private readonly shipping: ShippingMethodsService,
    private readonly bankAccounts: BankAccountsService,
  ) {}

  /** Cuentas activas para pagar por transferencia. */
  @Get('bank-accounts')
  bankAccountsForPayment(): Promise<BankAccountDto[]> {
    return this.bankAccounts.listActive();
  }

  /** Nombre, contacto e información regulatoria que muestra la tienda. */
  @Get('info')
  info(): Promise<PublicStoreInfoDto> {
    return this.settings.publicInfo();
  }

  /** Métodos de envío disponibles, con su tarifa fija. */
  @Get('shipping-methods')
  shippingMethods(): Promise<ShippingMethodDto[]> {
    return this.shipping.listActive();
  }
}
