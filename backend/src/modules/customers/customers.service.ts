import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../common/auth/auth-user.js';
import {
  paginationArgs,
  type Paginated,
} from '../../common/dto/pagination.dto.js';
import type { Customer, Prisma, User } from '../../generated/prisma/client.js';
import { UserType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MfaService } from '../auth/mfa.service.js';
import { AccountStatusService } from '../users/account-status.service.js';
import { searchFilter } from '../users/users.service.js';
import { toAddressDto } from './addresses.service.js';
import type {
  CustomerDetailDto,
  CustomerProfileDto,
  CustomerSummaryDto,
  ListCustomersQueryDto,
  SetCustomerStatusDto,
  UpdateProfileDto,
} from './dto/customers.dto.js';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountStatus: AccountStatusService,
    private readonly mfa: MfaService,
  ) {}

  // ─── Tienda ────────────────────────────────────────────────────────────────

  async getProfile(userId: string): Promise<CustomerProfileDto> {
    return toProfile(await this.findCustomer(userId));
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<CustomerProfileDto> {
    await this.findCustomer(userId);
    const { firstName, lastName, phone, taxId, taxName, birthDate } = dto;
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName,
        lastName,
        phone,
        customer: {
          update: {
            taxId,
            taxName,
            birthDate:
              birthDate === undefined
                ? undefined
                : new Date(`${birthDate}T00:00:00Z`),
          },
        },
      },
      include: { customer: true },
    });
    return toProfile(user as User & { customer: Customer });
  }

  // ─── Administración ────────────────────────────────────────────────────────

  async list(
    query: ListCustomersQueryDto,
  ): Promise<Paginated<CustomerSummaryDto>> {
    const where: Prisma.UserWhereInput = {
      type: UserType.CUSTOMER,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { OR: searchFilter(query.search) } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...paginationArgs(query),
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: rows.map(toSummary),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<CustomerDetailDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, type: UserType.CUSTOMER },
      include: {
        customer: {
          include: {
            addresses: {
              where: { deletedAt: null },
              orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    });
    if (!user?.customer) throw new NotFoundException('Cliente no encontrado');
    return {
      // toSummary devuelve un objeto plano; el tipo es una clase solo por Swagger.
      // oxlint-disable-next-line typescript/no-misused-spread
      ...toSummary(user),
      taxId: user.customer.taxId,
      taxName: user.customer.taxName,
      birthDate: dateOnly(user.customer.birthDate),
      addresses: user.customer.addresses.map(toAddressDto),
    };
  }

  async setStatus(
    actor: AuthUser,
    id: string,
    dto: SetCustomerStatusDto,
  ): Promise<CustomerDetailDto> {
    await this.accountStatus.changeStatus(
      actor,
      id,
      UserType.CUSTOMER,
      dto.status,
    );
    return this.get(id);
  }

  async resetMfa(actor: AuthUser, id: string): Promise<void> {
    await this.get(id);
    await this.mfa.resetForUser(actor, id);
  }

  private async findCustomer(
    userId: string,
  ): Promise<User & { customer: Customer }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, type: UserType.CUSTOMER },
      include: { customer: true },
    });
    if (!user?.customer) throw new NotFoundException('Cliente no encontrado');
    return user as User & { customer: Customer };
  }
}

function toProfile(user: User & { customer: Customer }): CustomerProfileDto {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    emailVerified: user.emailVerifiedAt !== null,
    taxId: user.customer.taxId,
    taxName: user.customer.taxName,
    birthDate: dateOnly(user.customer.birthDate),
  };
}

function toSummary(user: User): CustomerSummaryDto {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    status: user.status,
    emailVerified: user.emailVerifiedAt !== null,
    mfaEnabled: user.totpEnabledAt !== null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

function dateOnly(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}
