import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import {
  CurrentUser,
  CustomerOnly,
  RequirePermissions,
  StaffOnly,
} from '../../common/decorators/auth.decorators.js';
import { PERMISSIONS } from '../roles/permissions.catalog.js';
import {
  IncomeQueryDto,
  IncomeReportDto,
  InvoiceDto,
  InvoicePageDto,
  InvoicesQueryDto,
  RegisterFelDto,
  TaxRateAdminDto,
  TaxRateInputDto,
  UpdateTaxRateDto,
  VoidInvoiceDto,
} from './dto/billing.dto.js';
import { InvoicesService } from './invoices.service.js';
import { TaxRatesService } from './tax-rates.service.js';

@ApiTags('Admin · Facturación')
@StaffOnly()
@Controller('admin/billing')
export class AdminBillingController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly taxRates: TaxRatesService,
  ) {}

  @RequirePermissions(PERMISSIONS.BILLING_READ)
  @Get('invoices')
  list(@Query() query: InvoicesQueryDto): Promise<InvoicePageDto> {
    return this.invoices.list(query);
  }

  @RequirePermissions(PERMISSIONS.BILLING_READ)
  @Get('invoices/:id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<InvoiceDto> {
    return this.invoices.get(id);
  }

  /** Datos de la FEL emitida en el portal del certificador (D11). */
  @RequirePermissions(PERMISSIONS.BILLING_MANAGE)
  @Put('invoices/:id/fel')
  registerFel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterFelDto,
  ): Promise<InvoiceDto> {
    return this.invoices.registerFel(user.id, id, dto);
  }

  @RequirePermissions(PERMISSIONS.BILLING_MANAGE)
  @HttpCode(HttpStatus.OK)
  @Post('invoices/:id/void')
  void(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidInvoiceDto,
  ): Promise<InvoiceDto> {
    return this.invoices.void(user.id, id, dto.reason);
  }

  /** Ingresos (pagos − reembolsos) y facturación del periodo. */
  @RequirePermissions(PERMISSIONS.BILLING_READ)
  @Get('income')
  income(@Query() query: IncomeQueryDto): Promise<IncomeReportDto> {
    return this.invoices.income(query.from, query.to);
  }

  @RequirePermissions(PERMISSIONS.BILLING_READ)
  @Get('tax-rates')
  taxRatesList(): Promise<TaxRateAdminDto[]> {
    return this.taxRates.listAll();
  }

  @RequirePermissions(PERMISSIONS.BILLING_MANAGE)
  @Post('tax-rates')
  createTaxRate(@Body() dto: TaxRateInputDto): Promise<TaxRateAdminDto> {
    return this.taxRates.create(dto);
  }

  /** Un cambio de tasa aplica solo a las ventas futuras. */
  @RequirePermissions(PERMISSIONS.BILLING_MANAGE)
  @Patch('tax-rates/:id')
  updateTaxRate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaxRateDto,
  ): Promise<TaxRateAdminDto> {
    return this.taxRates.update(id, dto);
  }
}

@ApiTags('Tienda · Pedidos')
@CustomerOnly()
@Controller('store/orders')
export class StoreReceiptController {
  constructor(private readonly invoices: InvoicesService) {}

  /** Comprobante interno del pedido (no es factura). */
  @Get(':id/receipt')
  receipt(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InvoiceDto> {
    return this.invoices.getForCustomer(user.id, id);
  }
}
