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
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import {
  CurrentUser,
  RequirePermissions,
  StaffOnly,
} from '../../common/decorators/auth.decorators.js';
import { PERMISSIONS } from '../roles/permissions.catalog.js';
import {
  ListPurchaseOrdersQueryDto,
  ListSuppliersQueryDto,
  PurchaseOrderDetailDto,
  PurchaseOrderInputDto,
  PurchaseOrderPageDto,
  ReceiptInputDto,
  SupplierDto,
  SupplierInputDto,
  SupplierPageDto,
  UpdateSupplierDto,
} from './dto/purchasing.dto.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';
import { SuppliersService } from './suppliers.service.js';

@ApiTags('Admin · Compras')
@StaffOnly()
@Controller('admin')
export class PurchasingController {
  constructor(
    private readonly suppliers: SuppliersService,
    private readonly orders: PurchaseOrdersService,
  ) {}

  // ─── Proveedores ───────────────────────────────────────────────────────────

  @RequirePermissions(PERMISSIONS.PURCHASES_READ)
  @Get('suppliers')
  listSuppliers(
    @Query() query: ListSuppliersQueryDto,
  ): Promise<SupplierPageDto> {
    return this.suppliers.list(query);
  }

  @RequirePermissions(PERMISSIONS.PURCHASES_READ)
  @Get('suppliers/:id')
  getSupplier(@Param('id', ParseUUIDPipe) id: string): Promise<SupplierDto> {
    return this.suppliers.get(id);
  }

  @RequirePermissions(PERMISSIONS.PURCHASES_MANAGE)
  @Post('suppliers')
  createSupplier(@Body() dto: SupplierInputDto): Promise<SupplierDto> {
    return this.suppliers.create(dto);
  }

  @RequirePermissions(PERMISSIONS.PURCHASES_MANAGE)
  @Patch('suppliers/:id')
  updateSupplier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
  ): Promise<SupplierDto> {
    return this.suppliers.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.PURCHASES_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('suppliers/:id')
  removeSupplier(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.suppliers.remove(id);
  }

  // ─── Órdenes de compra ─────────────────────────────────────────────────────

  @RequirePermissions(PERMISSIONS.PURCHASES_READ)
  @Get('purchase-orders')
  listOrders(
    @Query() query: ListPurchaseOrdersQueryDto,
  ): Promise<PurchaseOrderPageDto> {
    return this.orders.list(query);
  }

  @RequirePermissions(PERMISSIONS.PURCHASES_READ)
  @Get('purchase-orders/:id')
  getOrder(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PurchaseOrderDetailDto> {
    return this.orders.get(id);
  }

  /** Crea la orden en borrador. Costos sin IVA; el impuesto se toma de cada producto. */
  @RequirePermissions(PERMISSIONS.PURCHASES_MANAGE)
  @Post('purchase-orders')
  createOrder(
    @CurrentUser() actor: AuthUser,
    @Body() dto: PurchaseOrderInputDto,
  ): Promise<PurchaseOrderDetailDto> {
    return this.orders.create(actor, dto);
  }

  @RequirePermissions(PERMISSIONS.PURCHASES_MANAGE)
  @Put('purchase-orders/:id')
  updateOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PurchaseOrderInputDto,
  ): Promise<PurchaseOrderDetailDto> {
    return this.orders.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.PURCHASES_APPROVE)
  @HttpCode(HttpStatus.OK)
  @Post('purchase-orders/:id/approve')
  approve(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PurchaseOrderDetailDto> {
    return this.orders.approve(actor, id);
  }

  @RequirePermissions(PERMISSIONS.PURCHASES_APPROVE)
  @HttpCode(HttpStatus.OK)
  @Post('purchase-orders/:id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PurchaseOrderDetailDto> {
    return this.orders.cancel(id);
  }

  @RequirePermissions(PERMISSIONS.PURCHASES_APPROVE)
  @HttpCode(HttpStatus.OK)
  @Post('purchase-orders/:id/close')
  close(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PurchaseOrderDetailDto> {
    return this.orders.close(id);
  }

  /** Recepción parcial o total con lotes y vencimientos (transaccional). */
  @RequirePermissions(PERMISSIONS.PURCHASES_RECEIVE)
  @Post('purchase-orders/:id/receipts')
  receive(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiptInputDto,
  ): Promise<PurchaseOrderDetailDto> {
    return this.orders.receive(actor, id, dto);
  }
}
