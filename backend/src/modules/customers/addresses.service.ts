import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CustomerAddress, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  AddressDto,
  AddressInputDto,
  UpdateAddressDto,
} from './dto/customers.dto.js';

export const MAX_ADDRESSES_PER_CUSTOMER = 10;

type Tx = Prisma.TransactionClient;

/**
 * Direcciones de entrega del cliente. Siempre hay exactamente una
 * predeterminada mientras exista al menos una dirección activa (un índice
 * único parcial lo garantiza en la base de datos).
 */
@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(customerId: string): Promise<AddressDto[]> {
    const addresses = await this.prisma.customerAddress.findMany({
      where: { customerId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return addresses.map(toAddressDto);
  }

  async create(customerId: string, dto: AddressInputDto): Promise<AddressDto> {
    const { isDefault, ...data } = dto;
    const address = await this.prisma.$transaction(async (tx) => {
      await this.lockCustomer(tx, customerId);
      const count = await tx.customerAddress.count({
        where: { customerId, deletedAt: null },
      });
      if (count >= MAX_ADDRESSES_PER_CUSTOMER) {
        throw new BadRequestException(
          `Puede registrar hasta ${MAX_ADDRESSES_PER_CUSTOMER} direcciones`,
        );
      }
      const makeDefault = count === 0 || isDefault === true;
      if (makeDefault) await this.clearDefault(tx, customerId);
      return tx.customerAddress.create({
        data: { ...data, customerId, isDefault: makeDefault },
      });
    });
    return toAddressDto(address);
  }

  async update(
    customerId: string,
    id: string,
    dto: UpdateAddressDto,
  ): Promise<AddressDto> {
    await this.findOwned(customerId, id);
    const address = await this.prisma.customerAddress.update({
      where: { id },
      data: dto,
    });
    return toAddressDto(address);
  }

  async setDefault(customerId: string, id: string): Promise<AddressDto> {
    const address = await this.prisma.$transaction(async (tx) => {
      await this.lockCustomer(tx, customerId);
      await this.findOwned(customerId, id, tx);
      await this.clearDefault(tx, customerId);
      return tx.customerAddress.update({
        where: { id },
        data: { isDefault: true },
      });
    });
    return toAddressDto(address);
  }

  /**
   * Eliminación lógica: los pedidos guardan su propia copia de la dirección.
   * Si era la predeterminada, pasa a serlo la más reciente de las restantes.
   */
  async remove(customerId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockCustomer(tx, customerId);
      const address = await this.findOwned(customerId, id, tx);
      await tx.customerAddress.update({
        where: { id },
        data: { deletedAt: new Date(), isDefault: false },
      });
      if (!address.isDefault) return;
      const next = await tx.customerAddress.findFirst({
        where: { customerId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (next)
        await tx.customerAddress.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
    });
  }

  private async findOwned(
    customerId: string,
    id: string,
    tx: Tx = this.prisma,
  ): Promise<CustomerAddress> {
    const address = await tx.customerAddress.findFirst({
      where: { id, customerId, deletedAt: null },
    });
    if (!address) throw new NotFoundException('Dirección no encontrada');
    return address;
  }

  private async clearDefault(tx: Tx, customerId: string): Promise<void> {
    await tx.customerAddress.updateMany({
      where: { customerId, isDefault: true, deletedAt: null },
      data: { isDefault: false },
    });
  }

  /** Serializa los cambios de direcciones de un mismo cliente (límite y predeterminada). */
  private async lockCustomer(tx: Tx, customerId: string): Promise<void> {
    await tx.$queryRaw`SELECT 1 FROM customers WHERE user_id = ${customerId}::uuid FOR UPDATE`;
  }
}

export function toAddressDto(address: CustomerAddress): AddressDto {
  return {
    id: address.id,
    label: address.label,
    recipientName: address.recipientName,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    zone: address.zone,
    municipality: address.municipality,
    department: address.department,
    reference: address.reference,
    isDefault: address.isDefault,
  };
}
