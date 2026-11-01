import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../common/auth/auth-user.js';
import {
  paginationArgs,
  type Paginated,
} from '../../common/dto/pagination.dto.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { UserStatus, UserType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { recordChanges } from '../audit/audit-trail.js';
import { AuthService } from '../auth/auth.service.js';
import { MfaService } from '../auth/mfa.service.js';
import { PasswordService } from '../auth/password.service.js';
import { AccountStatusService } from './account-status.service.js';
import type {
  CreateStaffUserDto,
  ListUsersQueryDto,
  RoleSummaryDto,
  StaffUserDto,
  UpdateStaffUserDto,
} from './dto/users.dto.js';

const staffSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  status: true,
  lockedUntil: true,
  lastLoginAt: true,
  totpEnabledAt: true,
  createdAt: true,
  roles: { select: { role: { select: { id: true, code: true, name: true } } } },
} satisfies Prisma.UserSelect;

type StaffRow = Prisma.UserGetPayload<{ select: typeof staffSelect }>;

/** Usuarios administrativos (personal). */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly auth: AuthService,
    private readonly accountStatus: AccountStatusService,
    private readonly mfa: MfaService,
  ) {}

  async list(query: ListUsersQueryDto): Promise<Paginated<StaffUserDto>> {
    const where: Prisma.UserWhereInput = {
      type: UserType.STAFF,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { OR: searchFilter(query.search) } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: staffSelect,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: rows.map(toDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<StaffUserDto> {
    return toDto(await this.findStaff(id));
  }

  /** Roles que se pueden asignar, sin exigir el permiso de consultar roles. */
  listAssignableRoles(): Promise<RoleSummaryDto[]> {
    return this.prisma.role.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Crea el usuario sin contraseña conocida y le envía un enlace para
   * definirla. El administrador nunca ve ni transmite contraseñas.
   */
  async create(dto: CreateStaffUserDto): Promise<StaffUserDto> {
    if (await this.prisma.user.findUnique({ where: { email: dto.email } })) {
      throw new ConflictException('Ya existe un usuario con ese correo');
    }
    await this.assertRolesExist(dto.roleIds);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await this.passwords.unusableHash(),
        type: UserType.STAFF,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        roles: { create: dto.roleIds.map((roleId) => ({ roleId })) },
      },
      select: staffSelect,
    });
    await this.auth.sendPasswordResetEmail(user, { invitation: true });
    return toDto(user);
  }

  async update(id: string, dto: UpdateStaffUserDto): Promise<StaffUserDto> {
    const before = await this.get(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: staffSelect,
    });
    const after = toDto(user);
    recordChanges(before, after);
    return after;
  }

  async setRoles(
    actor: AuthUser,
    id: string,
    roleIds: string[],
  ): Promise<StaffUserDto> {
    if (actor.id === id) {
      throw new BadRequestException('No puede modificar sus propios roles');
    }
    const before = await this.get(id);
    await this.assertRolesExist(roleIds);
    await this.prisma.$transaction(async (tx) => {
      const keepsSuperAdmin = await tx.role.count({
        where: { id: { in: roleIds }, code: 'SUPER_ADMIN' },
      });
      if (!keepsSuperAdmin)
        await this.accountStatus.assertNotLastSuperAdmin(tx, id);
      await tx.userRole.deleteMany({
        where: { userId: id, roleId: { notIn: roleIds } },
      });
      await tx.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId: id, roleId })),
        skipDuplicates: true,
      });
    });
    const after = await this.get(id);
    recordChanges({ roles: before.roles }, { roles: after.roles });
    return after;
  }

  async setStatus(
    actor: AuthUser,
    id: string,
    status: UserStatus,
  ): Promise<StaffUserDto> {
    const before = await this.get(id);
    await this.accountStatus.changeStatus(actor, id, UserType.STAFF, status);
    const after = await this.get(id);
    recordChanges({ status: before.status }, { status: after.status });
    return after;
  }

  /** Reenvía el enlace para definir contraseña (también sirve como reenvío de invitación). */
  async sendPasswordReset(id: string): Promise<void> {
    const user = await this.findStaff(id);
    if (user.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('El usuario no está activo');
    }
    await this.auth.sendPasswordResetEmail(user, {
      invitation: user.lastLoginAt === null,
    });
  }

  /** Para la pérdida del teléfono: el usuario configura el doble factor de nuevo al ingresar. */
  async resetMfa(actor: AuthUser, id: string): Promise<void> {
    await this.findStaff(id);
    await this.mfa.resetForUser(actor, id);
  }

  private async findStaff(id: string): Promise<StaffRow> {
    const user = await this.prisma.user.findFirst({
      where: { id, type: UserType.STAFF },
      select: staffSelect,
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  private async assertRolesExist(roleIds: string[]): Promise<void> {
    if (roleIds.length === 0) return;
    const found = await this.prisma.role.count({
      where: { id: { in: roleIds } },
    });
    if (found !== roleIds.length)
      throw new BadRequestException('Uno o más roles no existen');
  }
}

export function searchFilter(search: string): Prisma.UserWhereInput[] {
  const contains = { contains: search, mode: 'insensitive' as const };
  return [{ email: contains }, { firstName: contains }, { lastName: contains }];
}

function toDto(user: StaffRow): StaffUserDto {
  const now = new Date();
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    status: user.status,
    roles: user.roles.map((r) => r.role),
    lockedUntil:
      user.lockedUntil && user.lockedUntil > now
        ? user.lockedUntil.toISOString()
        : null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    mfaEnabled: user.totpEnabledAt !== null,
    createdAt: user.createdAt.toISOString(),
  };
}
