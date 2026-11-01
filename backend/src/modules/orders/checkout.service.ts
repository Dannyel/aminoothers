import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from '../../common/utils/money.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { cartProductInclude } from '../cart/cart.service.js';
import { defaultTaxRate } from '../cart/tax.js';
import { InventorySettingsService } from '../inventory/inventory-settings.service.js';
import { ReservationsService } from '../inventory/reservations.service.js';
import { orderTotals, priceLine } from '../pricing/pricing.js';
import { enqueueOrderPlaced } from '../notifications/outbox.js';
import { PromotionsService } from '../promotions/promotions.service.js';
import { saleBlocker } from '../storefront/sale-rules.js';
import type { OrderDetailDto, PlaceOrderDto } from './dto/orders.dto.js';
import { OrdersService } from './orders.service.js';

/**
 * Confirmación del pedido (reglas de negocio §5). Todo ocurre en una sola
 * transacción: se recalculan los importes, se reservan los lotes por FEFO, se
 * crea el pedido con sus copias y su pago pendiente, y se vacía el carrito.
 */
@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: ReservationsService,
    private readonly inventorySettings: InventorySettingsService,
    private readonly orders: OrdersService,
    private readonly promotions: PromotionsService,
  ) {}

  async place(
    customerId: string,
    idempotencyKey: string,
    dto: PlaceOrderDto,
  ): Promise<OrderDetailDto> {
    // Reintento del mismo envío (doble clic, red): se devuelve el pedido creado.
    const previous = await this.findByKey(customerId, idempotencyKey);
    if (previous) return previous;

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: customerId },
      include: { customer: true },
    });
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException(
        'Confirme su correo electrónico antes de realizar su primer pedido',
      );
    }
    const [settings, window, shippingTaxRate] = await Promise.all([
      this.prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } }),
      this.inventorySettings.window(),
      defaultTaxRate(this.prisma),
    ]);

    let orderId: string;
    try {
      orderId = await this.prisma.$transaction(
        async (tx) => {
          // Serializa los checkouts del mismo cliente sobre su carrito.
          const [cart] = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM carts WHERE customer_id = ${customerId}::uuid FOR UPDATE`;
          const duplicate = await tx.order.findUnique({
            where: {
              customerId_idempotencyKey: { customerId, idempotencyKey },
            },
            select: { id: true },
          });
          if (duplicate) return duplicate.id;

          const items = cart
            ? await tx.cartItem.findMany({
                where: { cartId: cart.id },
                include: { product: { include: cartProductInclude } },
                orderBy: { productId: 'asc' },
              })
            : [];
          if (!cart || items.length === 0)
            throw new BadRequestException('Su carrito está vacío');
          for (const { product, quantity } of items) {
            const blocker = saleBlocker(product);
            if (blocker) {
              throw new BadRequestException(
                `«${product.name}»: ${blocker}. Retírelo del carrito para continuar.`,
              );
            }
            if (quantity > settings.maxUnitsPerProduct) {
              throw new BadRequestException(
                `Puede pedir hasta ${settings.maxUnitsPerProduct} unidades de «${product.name}»`,
              );
            }
          }

          const address = await tx.customerAddress.findFirst({
            where: { id: dto.addressId, customerId, deletedAt: null },
          });
          if (!address) throw new NotFoundException('Dirección no encontrada');
          const method = await tx.shippingMethod.findFirst({
            where: {
              id: dto.shippingMethodId,
              deletedAt: null,
              isActive: true,
            },
          });
          if (!method)
            throw new BadRequestException(
              'El método de envío elegido ya no está disponible',
            );
          const cashOnDelivery =
            dto.paymentMethod === PaymentMethod.CASH_ON_DELIVERY;
          if (cashOnDelivery && !method.allowsCashOnDelivery) {
            throw new BadRequestException(
              `El envío «${method.name}» no admite pago contra entrega`,
            );
          }

          // Promoción vigente al momento de confirmar (la de mayor descuento).
          const promotions = await this.promotions.bestFor(
            items.map((i) => i.product),
            new Date(),
            tx,
          );
          const priced = items.map(({ product, quantity }) => ({
            product,
            promotionId: promotions.get(product.id)?.promotionId ?? null,
            line: priceLine({
              unitPrice: product.price,
              taxRate: product.taxRate.rate,
              quantity,
              unitDiscount: promotions.get(product.id)?.unitDiscount,
            }),
          }));
          const totals = orderTotals(
            priced.map((p) => p.line),
            { cost: method.cost, taxRate: shippingTaxRate },
          );
          if (!totals.total.equals(new Decimal(dto.expectedTotal))) {
            throw new ConflictException({
              message:
                'El total de su pedido cambió. Revise el resumen y confirme de nuevo.',
              code: 'TOTAL_CHANGED',
              total: totals.total.toFixed(2),
            });
          }

          const status = cashOnDelivery
            ? OrderStatus.PENDING_CONFIRMATION
            : OrderStatus.PENDING_PAYMENT;
          const hours = cashOnDelivery
            ? settings.codReservationHours
            : settings.transferReservationHours;
          const taxId = dto.billingTaxId ?? user.customer?.taxId ?? 'CF';
          const fullName = `${user.firstName} ${user.lastName}`;

          const order = await tx.order.create({
            data: {
              customerId,
              idempotencyKey,
              status,
              reservationExpiresAt: new Date(Date.now() + hours * 3_600_000),
              customerName: fullName,
              customerEmail: user.email,
              customerPhone: user.phone,
              billingTaxId: taxId,
              billingName:
                dto.billingName ??
                (taxId === 'CF'
                  ? 'Consumidor final'
                  : (user.customer?.taxName ?? fullName)),
              customerAddressId: address.id,
              shipRecipientName: address.recipientName,
              shipPhone: address.phone,
              shipAddressLine1: address.addressLine1,
              shipAddressLine2: address.addressLine2,
              shipZone: address.zone,
              shipMunicipality: address.municipality,
              shipDepartment: address.department,
              shipReference: address.reference,
              shippingMethodId: method.id,
              shippingMethodName: method.name,
              shippingCost: totals.shippingCost,
              shippingTax: totals.shippingTax,
              paymentMethod: dto.paymentMethod,
              subtotal: totals.subtotal,
              discountTotal: totals.discountTotal,
              taxTotal: totals.taxTotal,
              total: totals.total,
              customerNotes: dto.notes ?? null,
              items: {
                create: priced.map(({ product, line, promotionId }) => ({
                  productId: product.id,
                  promotionId,
                  sku: product.sku,
                  productName: product.name,
                  presentationLabel: product.presentation?.name ?? null,
                  concentrationLabel: product.concentration?.name ?? null,
                  saleCondition: product.saleCondition,
                  unitPrice: line.unitPrice,
                  unitDiscount: line.unitDiscount,
                  taxRate: line.taxRate,
                  quantity: line.quantity,
                  lineSubtotal: line.lineSubtotal,
                  lineDiscount: line.lineDiscount,
                  lineTax: line.lineTax,
                  lineTotal: line.lineTotal,
                })),
              },
              statusHistory: {
                create: { toStatus: status, changedById: customerId },
              },
              payments: {
                create: {
                  method: dto.paymentMethod,
                  amount: totals.total,
                  statusHistory: {
                    create: {
                      toStatus: PaymentStatus.PENDING,
                      changedById: customerId,
                    },
                  },
                },
              },
            },
            include: { items: { select: { id: true, productId: true } } },
          });

          // Reserva por FEFO en orden de producto para no interbloquear checkouts.
          const itemIds = new Map(order.items.map((i) => [i.productId, i.id]));
          for (const { product, quantity } of items) {
            const result = await this.reservations.reserve(
              tx,
              itemIds.get(product.id)!,
              product.id,
              quantity,
              window,
            );
            if (!result.ok) {
              throw new ConflictException({
                message:
                  result.available > 0
                    ? `Solo quedan ${result.available} unidad(es) de «${product.name}». Ajuste la cantidad en su carrito.`
                    : `«${product.name}» se agotó. Retírelo del carrito para continuar.`,
                code: 'INSUFFICIENT_STOCK',
                productId: product.id,
                available: result.available,
              });
            }
          }

          await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
          // Confirmación por correo, en la bandeja de salida (misma transacción).
          await enqueueOrderPlaced(tx, order.id);
          return order.id;
        },
        { maxWait: 5_000, timeout: 15_000 },
      );
    } catch (error) {
      // Dos envíos simultáneos con la misma clave: gana el primero.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const created = await this.findByKey(customerId, idempotencyKey);
        if (created) return created;
      }
      throw error;
    }

    return this.orders.getForCustomer(customerId, orderId);
  }

  private async findByKey(
    customerId: string,
    idempotencyKey: string,
  ): Promise<OrderDetailDto | null> {
    const order = await this.prisma.order.findUnique({
      where: { customerId_idempotencyKey: { customerId, idempotencyKey } },
      select: { id: true },
    });
    return order ? this.orders.getForCustomer(customerId, order.id) : null;
  }
}
