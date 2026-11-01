import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StockService } from '../inventory/stock.service.js';
import { orderTotals, priceLine } from '../pricing/pricing.js';
import { PromotionsService } from '../promotions/promotions.service.js';
import { toShippingMethodDto } from '../settings/shipping-methods.service.js';
import { ShippingMethodsService } from '../settings/shipping-methods.service.js';
import { StoreSettingsService } from '../settings/store-settings.service.js';
import {
  availabilityOf,
  maxPurchasable,
  saleBlocker,
  visibleProductWhere,
} from '../storefront/sale-rules.js';
import type { AddCartItemDto, CartDto, CartLineDto } from './dto/cart.dto.js';
import { defaultTaxRate } from './tax.js';

export const MAX_CART_LINES = 30;

export const cartProductInclude = {
  category: { select: { isActive: true, deletedAt: true } },
  presentation: { select: { name: true } },
  concentration: { select: { name: true } },
  taxRate: { select: { rate: true } },
  images: { where: { isPrimary: true }, select: { fileId: true } },
} satisfies Prisma.ProductInclude;

/**
 * Carrito del cliente autenticado. Solo guarda productos y cantidades; los
 * precios, la disponibilidad y los totales se calculan en cada consulta.
 */
@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly settings: StoreSettingsService,
    private readonly shipping: ShippingMethodsService,
    private readonly promotions: PromotionsService,
  ) {}

  async view(customerId: string, shippingMethodId?: string): Promise<CartDto> {
    const [items, settings, method] = await Promise.all([
      this.prisma.cartItem.findMany({
        where: { cart: { customerId } },
        include: { product: { include: cartProductInclude } },
        orderBy: { createdAt: 'asc' },
      }),
      this.settings.row(),
      shippingMethodId ? this.shipping.findActive(shippingMethodId) : null,
    ]);
    const [available, promotions] = await Promise.all([
      this.stock.availableByProduct(items.map((i) => i.productId)),
      this.promotions.bestFor(items.map((i) => i.product)),
    ]);

    const priced: ReturnType<typeof priceLine>[] = [];
    const lines: CartLineDto[] = items.map(({ product, quantity }) => {
      const units = available.get(product.id) ?? 0;
      const max = maxPurchasable(product, units, settings.maxUnitsPerProduct);
      const issue =
        saleBlocker(product) ??
        (units <= 0
          ? 'Producto agotado'
          : quantity > max
            ? units < settings.maxUnitsPerProduct
              ? `Solo hay ${max} unidad(es) disponible(s)`
              : `Máximo ${max} unidades por pedido`
            : null);
      const promo = promotions.get(product.id);
      const line = priceLine({
        unitPrice: product.price,
        taxRate: product.taxRate.rate,
        quantity,
        unitDiscount: promo?.unitDiscount,
      });
      if (!issue) priced.push(line);
      return {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        presentation: product.presentation?.name ?? null,
        concentration: product.concentration?.name ?? null,
        imageFileId: product.images[0]?.fileId ?? null,
        unitPrice: line.unitPrice.toFixed(2),
        unitDiscount: line.unitDiscount.toFixed(2),
        promotionName: promo?.name ?? null,
        quantity,
        lineTotal: line.lineTotal.toFixed(2),
        availability: availabilityOf(product, units),
        maxQuantity: max,
        issue,
      };
    });

    const totals = orderTotals(
      priced,
      method
        ? { cost: method.cost, taxRate: await defaultTaxRate(this.prisma) }
        : undefined,
    );
    return {
      lines,
      summary: {
        itemCount: priced.reduce((n, l) => n + l.quantity, 0),
        subtotal: totals.subtotal.toFixed(2),
        discountTotal: totals.discountTotal.toFixed(2),
        taxTotal: totals.taxTotal.toFixed(2),
        shippingCost: method ? totals.shippingCost.toFixed(2) : null,
        total: totals.total.toFixed(2),
      },
      shippingMethod: method ? toShippingMethodDto(method) : null,
      canCheckout: lines.length > 0 && lines.every((l) => !l.issue),
    };
  }

  async add(customerId: string, dto: AddCartItemDto): Promise<CartDto> {
    const cart = await this.prisma.cart.upsert({
      where: { customerId },
      create: { customerId },
      update: {},
      include: { items: { select: { productId: true, quantity: true } } },
    });
    const current =
      cart.items.find((i) => i.productId === dto.productId)?.quantity ?? 0;
    if (current === 0 && cart.items.length >= MAX_CART_LINES) {
      throw new BadRequestException(
        `El carrito admite hasta ${MAX_CART_LINES} productos distintos`,
      );
    }
    await this.assertCanHold(dto.productId, current + dto.quantity);
    await this.prisma.cartItem.upsert({
      where: {
        cartId_productId: { cartId: cart.id, productId: dto.productId },
      },
      create: {
        cartId: cart.id,
        productId: dto.productId,
        quantity: dto.quantity,
      },
      update: { quantity: { increment: dto.quantity } },
    });
    return this.view(customerId);
  }

  async setQuantity(
    customerId: string,
    productId: string,
    quantity: number,
  ): Promise<CartDto> {
    const item = await this.findItem(customerId, productId);
    await this.assertCanHold(productId, quantity);
    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity },
    });
    return this.view(customerId);
  }

  async remove(customerId: string, productId: string): Promise<CartDto> {
    const item = await this.findItem(customerId, productId);
    await this.prisma.cartItem.delete({ where: { id: item.id } });
    return this.view(customerId);
  }

  async clear(customerId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({ where: { cart: { customerId } } });
  }

  /** Unidades totales en el carrito (para el encabezado de la tienda). */
  async count(customerId: string): Promise<number> {
    const result = await this.prisma.cartItem.aggregate({
      where: { cart: { customerId } },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  }

  private async findItem(customerId: string, productId: string) {
    const item = await this.prisma.cartItem.findFirst({
      where: { productId, cart: { customerId } },
    });
    if (!item) throw new NotFoundException('El producto no está en su carrito');
    return item;
  }

  /** El producto debe venderse en línea y alcanzar para `quantity` unidades. */
  private async assertCanHold(productId: string, quantity: number) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, ...visibleProductWhere },
      include: cartProductInclude,
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    const blocker = saleBlocker(product);
    if (blocker) throw new BadRequestException(blocker);

    const [available, settings] = await Promise.all([
      this.stock.availableByProduct([productId]),
      this.settings.row(),
    ]);
    const units = available.get(productId) ?? 0;
    if (units <= 0) throw new ConflictException('Producto agotado');
    const max = maxPurchasable(product, units, settings.maxUnitsPerProduct);
    if (quantity > max) {
      throw new ConflictException(
        units < settings.maxUnitsPerProduct
          ? `Solo hay ${max} unidad(es) disponible(s) de este producto`
          : `Puede pedir hasta ${max} unidades de este producto`,
      );
    }
  }
}
