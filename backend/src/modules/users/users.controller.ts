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
  RequirePermissions,
  StaffOnly,
} from '../../common/decorators/auth.decorators.js';
import { PERMISSIONS } from '../roles/permissions.catalog.js';
import {
  CreateStaffUserDto,
  ListUsersQueryDto,
  RoleSummaryDto,
  SetUserRolesDto,
  SetUserStatusDto,
  StaffUserDto,
  StaffUserPageDto,
  UpdateStaffUserDto,
} from './dto/users.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('Admin · Usuarios')
@StaffOnly()
@Controller('admin/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @RequirePermissions(PERMISSIONS.USERS_READ)
  @Get()
  list(@Query() query: ListUsersQueryDto): Promise<StaffUserPageDto> {
    return this.users.list(query);
  }

  /** Roles disponibles para asignar a usuarios. */
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @Get('assignable-roles')
  listAssignableRoles(): Promise<RoleSummaryDto[]> {
    return this.users.listAssignableRoles();
  }

  @RequirePermissions(PERMISSIONS.USERS_READ)
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<StaffUserDto> {
    return this.users.get(id);
  }

  /** Crea el usuario y le envía por correo el enlace para definir su contraseña. */
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @Post()
  create(@Body() dto: CreateStaffUserDto): Promise<StaffUserDto> {
    return this.users.create(dto);
  }

  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffUserDto,
  ): Promise<StaffUserDto> {
    return this.users.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @Put(':id/roles')
  setRoles(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserRolesDto,
  ): Promise<StaffUserDto> {
    return this.users.setRoles(actor, id, dto.roleIds);
  }

  /** Activar, bloquear o desactivar. Bloquear o desactivar cierra sus sesiones. */
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @Patch(':id/status')
  setStatus(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserStatusDto,
  ): Promise<StaffUserDto> {
    return this.users.setStatus(actor, id, dto.status);
  }

  /** Restablece el doble factor (pérdida del teléfono). Cierra sus sesiones. */
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':id/mfa-reset')
  resetMfa(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.users.resetMfa(actor, id);
  }

  /** Envía al usuario un enlace para definir una contraseña nueva. */
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':id/password-reset')
  sendPasswordReset(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.users.sendPasswordReset(id);
  }
}
