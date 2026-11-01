import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ShippingMethodDto } from '../../settings/dto/settings.dto.js';
import { Availability } from '../../storefront/sale-rules.js';

// ─── Peticiones ──────────────────────────────────────────────────────────────

export class AddCartItemDto {
  @IsUUID()
  productId: string;

  /** Unidades a agregar a las que ya hay en el carrito. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  quantity: number;
}

export class SetCartQuantityDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  quantity: number;
}

export class CartQueryDto {
  /** Método de envío para incluir su costo en el resumen. */
  @IsOptional()
  @IsUUID()
  shippingMethodId?: string;
}

// ─── Respuestas ──────────────────────────────────────────────────────────────

export class CartLineDto {
  productId: string;
  slug: string;
  name: string;
  presentation: string | null;
  concentration: string | null;
  imageFileId: string | null;
  /** Precio normal actual con IVA incluido. */
  unitPrice: string;
  /** Descuento unitario de la promoción vigente (0 si no hay). */
  unitDiscount: string;
  promotionName: string | null;
  quantity: number;
  /** Con el descuento aplicado. */
  lineTotal: string;
  @ApiProperty({ enum: Availability, enumName: 'Availability' })
  availability: Availability;
  /** Unidades que se pueden pedir ahora. */
  maxQuantity: number;
  /** Por qué la línea no se puede comprar tal como está, o null. */
  issue: string | null;
}

/** Importes de referencia; el checkout los recalcula al confirmar. */
export class CartSummaryDto {
  /** Unidades de las líneas que se pueden comprar. */
  itemCount: number;
  subtotal: string;
  discountTotal: string;
  /** IVA incluido en los importes. */
  taxTotal: string;
  /** null mientras no se elija método de envío. */
  shippingCost: string | null;
  total: string;
}

export class CartDto {
  lines: CartLineDto[];
  summary: CartSummaryDto;
  shippingMethod: ShippingMethodDto | null;
  /** true si hay líneas y ninguna tiene problemas. */
  canCheckout: boolean;
}
