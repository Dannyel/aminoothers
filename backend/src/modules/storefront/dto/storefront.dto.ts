import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SaleCondition } from '../../../generated/prisma/enums.js';
import { Availability } from '../sale-rules.js';

const SLUG = /^[a-z0-9-]{1,250}$/;
export const STORE_SORTS = [
  'name',
  'price_asc',
  'price_desc',
  'newest',
] as const;

// ─── Peticiones ──────────────────────────────────────────────────────────────

export class StoreProductsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;

  /** Máximo 48 por página. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(48) pageSize: number =
    24;

  /** Nombre, marca, principio activo, SKU o código de barras. */
  @IsOptional() @IsString() @MaxLength(100) search?: string;

  /** Slug de la categoría. */
  @IsOptional() @Matches(SLUG) category?: string;

  /** Slug de la subcategoría (dentro de la categoría). */
  @IsOptional() @Matches(SLUG) subcategory?: string;

  /** Slug de la marca. */
  @IsOptional() @Matches(SLUG) brand?: string;

  @IsOptional() @IsIn(STORE_SORTS) sort: (typeof STORE_SORTS)[number] = 'name';
}

// ─── Respuestas ──────────────────────────────────────────────────────────────

export class StoreRefDto {
  id: string;
  name: string;
  slug: string;
}

export class StoreSubcategoryDto extends StoreRefDto {}

export class StoreCategoryDto extends StoreRefDto {
  description: string | null;
  imageFileId: string | null;
  /** Productos visibles en la tienda. */
  productCount: number;
  subcategories: StoreSubcategoryDto[];
}

export class StorePromotionDto {
  name: string;
  /** Precio con el descuento aplicado (IVA incluido). */
  price: string;
  discount: string;
  endsAt: string;
}

export class StoreProductDto {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  /** Precio normal con IVA incluido. */
  price: string;
  /** Promoción vigente de mayor descuento, si hay. */
  promotion: StorePromotionDto | null;
  brand: StoreRefDto | null;
  presentation: string | null;
  concentration: string | null;
  @ApiProperty({ enum: SaleCondition, enumName: 'SaleCondition' })
  saleCondition: SaleCondition;
  @ApiProperty({ enum: Availability, enumName: 'Availability' })
  availability: Availability;
  /** Unidades que se pueden agregar al carrito (0 si no se vende en línea). */
  maxQuantity: number;
  primaryImageFileId: string | null;
}

export class StoreProductPageDto {
  items: StoreProductDto[];
  total: number;
  page: number;
  pageSize: number;
  /** Marcas presentes con los filtros actuales (sin el de marca). */
  brands: StoreRefDto[];
}

export class StoreProductImageDto {
  fileId: string;
  altText: string | null;
}

export class StoreProductDetailDto extends StoreProductDto {
  description: string | null;
  category: StoreRefDto;
  subcategory: StoreRefDto | null;
  manufacturer: string | null;
  activeIngredients: string[];
  sanitaryRegistration: string | null;
  images: StoreProductImageDto[];
}
