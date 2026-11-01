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
import { CustomersService } from './customers.service.js';
import {
  CustomerDetailDto,
  CustomerPageDto,
  ListCustomersQueryDto,
  SetCustomerStatusDto,
} from './dto/customers.dto.js';

@ApiTags('Admin · Clientes')
@StaffOnly()
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(private readonly customers: CustomersService) {}

  @RequirePermissions(PERMISSIONS.CUSTOMERS_READ)
  @Get()
  list(@Query() query: ListCustomersQueryDto): Promise<CustomerPageDto> {
    return this.customers.list(query);
  }

  @RequirePermissions(PERMISSIONS.CUSTOMERS_READ)
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<CustomerDetailDto> {
    return this.customers.get(id);
  }

  /** Activar, bloquear o desactivar. Bloquear o desactivar cierra sus sesiones. */
  @RequirePermissions(PERMISSIONS.CUSTOMERS_MANAGE)
  @Patch(':id/status')
  setStatus(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCustomerStatusDto,
  ): Promise<CustomerDetailDto> {
    return this.customers.setStatus(actor, id, dto);
  }

  /** Restablece el doble factor (pérdida del teléfono). Cierra sus sesiones. */
  @RequirePermissions(PERMISSIONS.CUSTOMERS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':id/mfa-reset')
  resetMfa(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.customers.resetMfa(actor, id);
  }
}
