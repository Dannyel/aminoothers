import { BadRequestException } from '@nestjs/common';
import type { DecimalValue } from '../../common/utils/money.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

/** Tasa predeterminada (IVA): se aplica al costo de envío, que es un servicio. */
export async function defaultTaxRate(
  prisma: Pick<PrismaService, 'taxRate'>,
): Promise<DecimalValue> {
  const rate = await prisma.taxRate.findFirst({
    where: { isDefault: true, isActive: true },
    select: { rate: true },
  });
  if (!rate)
    throw new BadRequestException('No hay una tasa de impuesto predeterminada');
  return rate.rate;
}
