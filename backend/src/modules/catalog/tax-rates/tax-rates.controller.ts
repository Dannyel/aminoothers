import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  RequirePermissions,
  StaffOnly,
} from '../../../common/decorators/auth.decorators.js';
import { TaxRateDto } from '../../billing/dto/billing.dto.js';
import { TaxRatesService } from '../../billing/tax-rates.service.js';
import { PERMISSIONS } from '../../roles/permissions.catalog.js';

/** Tasas activas para el formulario de producto (se administran en Facturación). */
@ApiTags('Admin · Catálogos')
@StaffOnly()
@Controller('admin/tax-rates')
export class TaxRatesController {
  constructor(private readonly taxRates: TaxRatesService) {}

  @RequirePermissions(PERMISSIONS.PRODUCTS_READ)
  @Get()
  list(): Promise<TaxRateDto[]> {
    return this.taxRates.listActive();
  }
}
