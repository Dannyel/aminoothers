import { Injectable, NotFoundException } from '@nestjs/common';
import type { BankAccount } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  BankAccountDto,
  BankAccountInputDto,
  UpdateBankAccountDto,
} from './dto/settings.dto.js';

const vigente = { deletedAt: null };
const order = [{ sortOrder: 'asc' }, { bankName: 'asc' }] as const;

/** Cuentas de la farmacia para recibir transferencias. */
@Injectable()
export class BankAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<BankAccountDto[]> {
    const rows = await this.prisma.bankAccount.findMany({
      where: vigente,
      orderBy: [...order],
    });
    return rows.map(toBankAccountDto);
  }

  /** Las que ve el cliente para pagar. */
  async listActive(): Promise<BankAccountDto[]> {
    const rows = await this.prisma.bankAccount.findMany({
      where: { ...vigente, isActive: true },
      orderBy: [...order],
    });
    return rows.map(toBankAccountDto);
  }

  async create(dto: BankAccountInputDto): Promise<BankAccountDto> {
    return toBankAccountDto(
      await this.prisma.bankAccount.create({ data: dto }),
    );
  }

  async update(id: string, dto: UpdateBankAccountDto): Promise<BankAccountDto> {
    await this.find(id);
    return toBankAccountDto(
      await this.prisma.bankAccount.update({ where: { id }, data: dto }),
    );
  }

  /** Baja lógica: los pagos registrados conservan la cuenta de destino. */
  async remove(id: string): Promise<void> {
    await this.find(id);
    await this.prisma.bankAccount.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  private async find(id: string): Promise<BankAccount> {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id, ...vigente },
    });
    if (!account) throw new NotFoundException('Cuenta bancaria no encontrada');
    return account;
  }
}

export function toBankAccountDto(a: BankAccount): BankAccountDto {
  return {
    id: a.id,
    bankName: a.bankName,
    accountNumber: a.accountNumber,
    accountType: a.accountType,
    accountHolder: a.accountHolder,
    currency: a.currency,
    instructions: a.instructions,
    isActive: a.isActive,
    sortOrder: a.sortOrder,
  };
}
