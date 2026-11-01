import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
  AdminOrderDetailDto,
  AdminOrderSummaryPageDto,
  ReturnDto,
} from './dto/orders.dto.js';
import {
  AdminOrdersQueryDto,
  CreateReturnDto,
  DeliverOrderDto,
  DispatchOrderDto,
  OrderNoteDto,
  RedispatchOrderDto,
  RequiredNoteDto,
  ShipmentEventInputDto,
  StaffCancelOrderDto,
} from './dto/sales.dto.js';
import { OrderWorkflowService } from './order-workflow.service.js';
import { OrdersService } from './orders.service.js';
import { ReturnsService } from './returns.service.js';

@ApiTags('Admin · Pedidos')
@StaffOnly()
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly workflow: OrderWorkflowService,
    private readonly returns: ReturnsService,
  ) {}

  /** Búsqueda por número, nombre o correo del cliente; filtros por estado, pago y fechas. */
  @RequirePermissions(PERMISSIONS.ORDERS_READ)
  @Get()
  list(@Query() query: AdminOrdersQueryDto): Promise<AdminOrderSummaryPageDto> {
    return this.orders.listForStaff(query);
  }

  @RequirePermissions(PERMISSIONS.ORDERS_READ)
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminOrderDetailDto> {
    return this.orders.getForStaff(id);
  }

  /** Contra entrega: el personal confirma el pedido. */
  @RequirePermissions(PERMISSIONS.ORDERS_MANAGE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/confirm')
  async confirm(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OrderNoteDto,
  ): Promise<AdminOrderDetailDto> {
    await this.workflow.confirm(user.id, id, dto.note);
    return this.orders.getForStaff(id);
  }

  @RequirePermissions(PERMISSIONS.ORDERS_MANAGE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/prepare')
  async prepare(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OrderNoteDto,
  ): Promise<AdminOrderDetailDto> {
    await this.workflow.prepare(user.id, id, dto.note);
    return this.orders.getForStaff(id);
  }

  /** Entrega a la mensajería; descuenta del inventario los lotes reservados. */
  @RequirePermissions(PERMISSIONS.SHIPMENTS_MANAGE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/dispatch')
  async dispatch(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DispatchOrderDto,
  ): Promise<AdminOrderDetailDto> {
    await this.workflow.dispatch(user.id, id, dto);
    return this.orders.getForStaff(id);
  }

  @RequirePermissions(PERMISSIONS.SHIPMENTS_MANAGE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/shipment/events')
  async addEvent(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShipmentEventInputDto,
  ): Promise<AdminOrderDetailDto> {
    await this.workflow.addEvent(user.id, id, dto);
    return this.orders.getForStaff(id);
  }

  /** Contra entrega exige el monto cobrado y el permiso payments.collect. */
  @RequirePermissions(PERMISSIONS.SHIPMENTS_MANAGE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/deliver')
  async deliver(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeliverOrderDto,
  ): Promise<AdminOrderDetailDto> {
    await this.workflow.deliver(
      user.id,
      user.isSuperAdmin ? 'all' : user.permissions,
      id,
      dto,
    );
    return this.orders.getForStaff(id);
  }

  @RequirePermissions(PERMISSIONS.SHIPMENTS_MANAGE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/delivery-failed')
  async fail(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequiredNoteDto,
  ): Promise<AdminOrderDetailDto> {
    await this.workflow.fail(user.id, id, dto.note);
    return this.orders.getForStaff(id);
  }

  @RequirePermissions(PERMISSIONS.SHIPMENTS_MANAGE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/redispatch')
  async redispatch(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RedispatchOrderDto,
  ): Promise<AdminOrderDetailDto> {
    await this.workflow.redispatch(user.id, id, dto);
    return this.orders.getForStaff(id);
  }

  /** La mensajería devolvió el paquete: crea la devolución pendiente de inspección. */
  @RequirePermissions(PERMISSIONS.SHIPMENTS_MANAGE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/return-to-store')
  async returnToStore(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequiredNoteDto,
  ): Promise<AdminOrderDetailDto> {
    await this.workflow.returnToStore(user.id, id, dto.note);
    return this.orders.getForStaff(id);
  }

  /** Libera las reservas; si ya estaba pagado deja un reembolso pendiente. */
  @RequirePermissions(PERMISSIONS.ORDERS_MANAGE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  async cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StaffCancelOrderDto,
  ): Promise<AdminOrderDetailDto> {
    await this.workflow.cancelByStaff(user.id, id, dto.reason);
    return this.orders.getForStaff(id);
  }

  /** Devolución de un pedido entregado, dentro del plazo (D7). */
  @RequirePermissions(PERMISSIONS.RETURNS_MANAGE)
  @Post(':id/returns')
  createReturn(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReturnDto,
  ): Promise<ReturnDto> {
    return this.returns.create(user.id, id, dto);
  }
}
