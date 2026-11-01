import { SaleCondition } from '../../generated/prisma/enums.js';

/** Datos del producto que deciden si se vende en línea. */
export interface SaleFacts {
  isActive: boolean;
  deletedAt: Date | null;
  onlineSaleEnabled: boolean;
  saleCondition: SaleCondition;
  category: { isActive: boolean; deletedAt: Date | null };
}

/**
 * Disponibilidad que ve el cliente:
 * - PHARMACY_ONLY: requiere receta o es controlado; solo informativo (D2).
 * - NOT_FOR_SALE: aún sin habilitación regulatoria, o inactivo.
 * - OUT_OF_STOCK / LOW_STOCK / AVAILABLE: según la existencia vendible.
 */
export const Availability = {
  AVAILABLE: 'AVAILABLE',
  LOW_STOCK: 'LOW_STOCK',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  PHARMACY_ONLY: 'PHARMACY_ONLY',
  NOT_FOR_SALE: 'NOT_FOR_SALE',
} as const;
export type Availability = (typeof Availability)[keyof typeof Availability];

/** Hasta estas unidades disponibles se muestra "últimas unidades". */
export const LOW_STOCK_UNITS = 5;

/** Visible en la tienda: vigente, activo y de una categoría activa. */
export const visibleProductWhere = {
  deletedAt: null,
  isActive: true,
  category: { deletedAt: null, isActive: true },
} as const;

/**
 * Motivo por el que el producto no se puede comprar en línea, o null si se
 * puede (reglas de negocio §1). La existencia se evalúa aparte.
 */
export function saleBlocker(product: SaleFacts): string | null {
  if (
    !product.isActive ||
    product.deletedAt ||
    !product.category.isActive ||
    product.category.deletedAt
  ) {
    return 'El producto ya no está disponible';
  }
  if (product.saleCondition !== SaleCondition.OTC) {
    return 'Este producto requiere receta médica y solo se vende en la farmacia';
  }
  if (!product.onlineSaleEnabled) {
    return 'Este producto no está habilitado para la venta en línea';
  }
  return null;
}

export function availabilityOf(
  product: SaleFacts,
  available: number,
): Availability {
  if (
    product.saleCondition !== SaleCondition.OTC &&
    product.isActive &&
    !product.deletedAt
  ) {
    return Availability.PHARMACY_ONLY;
  }
  if (saleBlocker(product)) return Availability.NOT_FOR_SALE;
  if (available <= 0) return Availability.OUT_OF_STOCK;
  return available <= LOW_STOCK_UNITS
    ? Availability.LOW_STOCK
    : Availability.AVAILABLE;
}

/** Unidades que el cliente puede pedir de un producto. */
export function maxPurchasable(
  product: SaleFacts,
  available: number,
  maxUnitsPerProduct: number,
): number {
  return saleBlocker(product)
    ? 0
    : Math.max(0, Math.min(available, maxUnitsPerProduct));
}
