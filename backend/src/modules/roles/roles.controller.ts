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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  RequirePermissions,
  StaffOnly,
} from '../../common/decorators/auth.decorators.js';
import {
  CreateRoleDto,
  PermissionDto,
  RoleDto,
  UpdateRoleDto,
} from './dto/roles.dto.js';
import { PERMISSIONS } from './permissions.catalog.js';
import { RolesService } from './roles.service.js';

@ApiTags('Admin · Roles y permisos')
@StaffOnly()
@Controller('admin')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  /** Catálogo de permisos disponibles. */
  @RequirePermissions(PERMISSIONS.ROLES_READ)
  @Get('permissions')
  listPermissions(): PermissionDto[] {
    return this.roles.listPermissions();
  }

  @RequirePermissions(PERMISSIONS.ROLES_READ)
  @Get('roles')
  list(): Promise<RoleDto[]> {
    return this.roles.list();
  }

  @RequirePermissions(PERMISSIONS.ROLES_READ)
  @Get('roles/:id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<RoleDto> {
    return this.roles.get(id);
  }

  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @Post('roles')
  create(@Body() dto: CreateRoleDto): Promise<RoleDto> {
    return this.roles.create(dto);
  }

  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @Patch('roles/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleDto> {
    return this.roles.update(id, dto);
  }

  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('roles/:id')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.roles.remove(id);
  }
}
