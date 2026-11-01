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
import { ReturnDto, ReturnPageDto } from './dto/orders.dto.js';
import {
  InspectReturnItemDto,
  RejectReturnDto,
  ReturnsQueryDto,
} from './dto/sales.dto.js';
import { ReturnsService } from './returns.service.js';

@ApiTags('Admin · Devoluciones')
@StaffOnly()
@Controller('admin/returns')
export class AdminReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @RequirePermissions(PERMISSIONS.ORDERS_READ)
  @Get()
  list(@Query() query: ReturnsQueryDto): Promise<ReturnPageDto> {
    return this.returns.list(query);
  }

  @RequirePermissions(PERMISSIONS.ORDERS_READ)
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<ReturnDto> {
    return this.returns.get(id);
  }

  @RequirePermissions(PERMISSIONS.RETURNS_MANAGE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/approve')
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReturnDto> {
    return this.returns.approve(user.id, id);
  }

  @RequirePermissions(PERMISSIONS.RETURNS_MANAGE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/reject')
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectReturnDto,
  ): Promise<ReturnDto> {
    return this.returns.reject(user.id, id, dto.reason);
  }

  /** Las unidades llegaron a la farmacia; quedan pendientes de inspección. */
  @RequirePermissions(PERMISSIONS.RETURNS_MANAGE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/receive')
  receive(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReturnDto> {
    return this.returns.receive(user.id, id);
  }

  /** RESTOCK reincorpora al lote original; DESTROY o RETURN_TO_SUPPLIER no. */
  @RequirePermissions(PERMISSIONS.RETURNS_INSPECT)
  @HttpCode(HttpStatus.OK)
  @Post(':id/items/:itemId/inspect')
  inspect(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: InspectReturnItemDto,
  ): Promise<ReturnDto> {
    return this.returns.inspect(user.id, id, itemId, dto);
  }
}
