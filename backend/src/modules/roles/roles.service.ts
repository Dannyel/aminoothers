import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SUPER_ADMIN_ROLE } from '../../common/auth/auth-user.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { recordChanges } from '../audit/audit-trail.js';
import type {
  CreateRoleDto,
  PermissionDto,
  RoleDto,
  UpdateRoleDto,
} from './dto/roles.dto.js';
import { PERMISSION_CATALOG } from './permissions.catalog.js';

const roleInclude = {
  permissions: { select: { permission: { select: { code: true } } } },
  _count: { select: { users: true } },
} satisfies Prisma.RoleInclude;

type RoleRow = Prisma.RoleGetPayload<{ include: typeof roleInclude }>;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  listPermissions(): PermissionDto[] {
    return PERMISSION_CATALOG.map(({ code, module, description }) => ({
      code,
      module,
      description,
    }));
  }

  async list(): Promise<RoleDto[]> {
    const roles = await this.prisma.role.findMany({
      include: roleInclude,
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    return roles.map(toDto);
  }

  async get(id: string): Promise<RoleDto> {
    return toDto(await this.find(id));
  }

  async create(dto: CreateRoleDto): Promise<RoleDto> {
    if (await this.prisma.role.findUnique({ where: { code: dto.code } })) {
      throw new ConflictException('Ya existe un rol con ese código');
    }
    const permissionIds = await this.resolvePermissions(dto.permissions);
    const role = await this.prisma.role.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        permissions: {
          create: permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
      include: roleInclude,
    });
    return toDto(role);
  }

  async update(id: string, dto: UpdateRoleDto): Promise<RoleDto> {
    const role = await this.find(id);
    if (role.code === SUPER_ADMIN_ROLE) {
      throw new BadRequestException(
        'El rol de superadministrador no se puede modificar',
      );
    }
    const before = await this.get(id);
    const permissionIds =
      dto.permissions === undefined
        ? undefined
        : await this.resolvePermissions(dto.permissions);
    await this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: { name: dto.name, description: dto.description },
      });
      if (permissionIds) {
        await tx.rolePermission.deleteMany({
          where: { roleId: id, permissionId: { notIn: permissionIds } },
        });
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId: id,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }
    });
    const after = await this.get(id);
    recordChanges(before, after);
    return after;
  }

  async remove(id: string): Promise<void> {
    const role = await this.find(id);
    if (role.isSystem)
      throw new BadRequestException(
        'Los roles de sistema no se pueden eliminar',
      );
    if (role._count.users > 0) {
      throw new ConflictException(
        'El rol tiene usuarios asignados; quíteselo antes de eliminarlo',
      );
    }
    await this.prisma.role.delete({ where: { id } });
  }

  private async find(id: string): Promise<RoleRow> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: roleInclude,
    });
    if (!role) throw new NotFoundException('Rol no encontrado');
    return role;
  }

  private async resolvePermissions(codes: string[]): Promise<string[]> {
    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true },
    });
    if (permissions.length !== codes.length) {
      const known = new Set(permissions.map((p) => p.code));
      const unknown = codes.filter((code) => !known.has(code));
      throw new BadRequestException(
        `Permisos desconocidos: ${unknown.join(', ')}`,
      );
    }
    return permissions.map((p) => p.id);
  }
}

function toDto(role: RoleRow): RoleDto {
  const isSuperAdmin = role.code === SUPER_ADMIN_ROLE;
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    isSuperAdmin,
    permissions: isSuperAdmin
      ? PERMISSION_CATALOG.map((p) => p.code)
      : role.permissions.map((p) => p.permission.code).sort(),
    userCount: role._count.users,
  };
}
