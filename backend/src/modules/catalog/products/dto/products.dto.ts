import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination.dto.js';
import { IsRequiredText } from '../../../../common/validation/validators.js';
import { SaleCondition } from '../../../../generated/prisma/enums.js';

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);

/** Importe positivo con hasta 2 decimales, como texto para no perder precisión ("125.50"). */
const IsMoney = () =>
  Matches(/^(?!0+(\.0{1,2})?$)\d{1,10}(\.\d{1,2})?$/, {
    message:
      'El precio debe ser mayor que cero y tener hasta 2 decimales (p. ej. 125.50)',
  });

// ─── Peticiones ──────────────────────────────────────────────────────────────

export class CreateProductDto {
  @trim
  @Matches(/^[A-Za-z0-9._-]{1,50}$/, {
    message:
      'El SKU solo admite letras, números, punto, guion y guion bajo (máx. 50)',
  })
  sku: string;

  @IsOptional()
  @trim
  @Matches(/^[0-9A-Za-z-]{4,50}$/, { message: 'Código de barras inválido' })
  barcode?: string | null;

  @IsRequiredText(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  shortDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string | null;

  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsUUID()
  subcategoryId?: string | null;

  @IsOptional()
  @IsUUID()
  brandId?: string | null;

  @IsOptional()
  @IsUUID()
  manufacturerId?: string | null;

  @IsOptional()
  @IsUUID()
  presentationId?: string | null;

  @IsOptional()
  @IsUUID()
  concentrationId?: string | null;

  /** Principios activos (vacío para productos que no son medicamentos). */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  activeIngredientIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  tagIds?: string[];

  @IsOptional()
  @trim
  @IsString()
  @MaxLength(100)
  sanitaryRegistration?: string | null;

  /** AAAA-MM-DD. */
  @IsOptional()
  @IsDateString({ strict: true })
  sanitaryRegistrationExpiresAt?: string | null;

  /** Precio de venta con IVA incluido. */
  @IsMoney()
  price: string;

  /** Si se omite, se usa la tasa predeterminada (IVA). */
  @IsOptional()
  @IsUUID()
  taxRateId?: string;

  @IsEnum(SaleCondition)
  @ApiProperty({ enum: SaleCondition, enumName: 'SaleCondition' })
  saleCondition: SaleCondition;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  lowStockThreshold?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProductDto {
  @IsOptional() @IsRequiredText(200) name?: string;
  @IsOptional()
  @trim
  @Matches(/^[0-9A-Za-z-]{4,50}$/, { message: 'Código de barras inválido' })
  barcode?: string | null;
  @IsOptional() @IsString() @MaxLength(300) shortDescription?: string | null;
  @IsOptional() @IsString() @MaxLength(10_000) description?: string | null;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() subcategoryId?: string | null;
  @IsOptional() @IsUUID() brandId?: string | null;
  @IsOptional() @IsUUID() manufacturerId?: string | null;
  @IsOptional() @IsUUID() presentationId?: string | null;
  @IsOptional() @IsUUID() concentrationId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  activeIngredientIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  tagIds?: string[];

  @IsOptional() @trim @IsString() @MaxLength(100) sanitaryRegistration?:
    string | null;
  @IsOptional() @IsDateString({ strict: true }) sanitaryRegistrationExpiresAt?:
    string | null;
  @IsOptional() @IsMoney() price?: string;
  @IsOptional() @IsUUID() taxRateId?: string;

  @IsOptional()
  @IsEnum(SaleCondition)
  @ApiProperty({
    enum: SaleCondition,
    enumName: 'SaleCondition',
    required: false,
  })
  saleCondition?: SaleCondition;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  lowStockThreshold?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SetOnlineSaleDto {
  @IsBoolean()
  enabled: boolean;
}

export class ListProductsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() subcategoryId?: string;
  @IsOptional() @IsUUID() brandId?: string;
  @IsOptional() @IsUUID() activeIngredientId?: string;

  @IsOptional()
  @IsEnum(SaleCondition)
  @ApiProperty({
    enum: SaleCondition,
    enumName: 'SaleCondition',
    required: false,
  })
  saleCondition?: SaleCondition;

  /** active, inactive o all (por defecto). */
  @IsOptional()
  @IsIn(['active', 'inactive', 'all'])
  @ApiProperty({ enum: ['active', 'inactive', 'all'], required: false })
  status: 'active' | 'inactive' | 'all' = 'all';

  /** yes, no o all (por defecto): habilitados para la venta en línea. */
  @IsOptional()
  @IsIn(['yes', 'no', 'all'])
  @ApiProperty({ enum: ['yes', 'no', 'all'], required: false })
  onlineSale: 'yes' | 'no' | 'all' = 'all';
}

export class UpdateProductImageDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  altText?: string | null;

  /** true la convierte en la imagen principal. */
  @IsOptional()
  @IsIn([true], { message: 'isPrimary solo admite true' })
  isPrimary?: true;
}

export class ReorderImagesDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  imageIds: string[];
}

// ─── Respuestas ──────────────────────────────────────────────────────────────

export class NamedRefDto {
  id: string;
  name: string;
}

export class ProductImageDto {
  id: string;
  /** Id del archivo (se sirve en /files/:fileId). */
  fileId: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export class ProductListItemDto {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  slug: string;
  /** Precio con IVA incluido, como texto decimal. */
  price: string;
  category: NamedRefDto;
  brand: NamedRefDto | null;
  presentation: NamedRefDto | null;
  concentration: NamedRefDto | null;
  @ApiProperty({ enum: SaleCondition, enumName: 'SaleCondition' })
  saleCondition: SaleCondition;
  requiresPrescription: boolean;
  isActive: boolean;
  onlineSaleEnabled: boolean;
  primaryImageFileId: string | null;
}

export class ProductPageDto {
  items: ProductListItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class TaxRateRefDto {
  id: string;
  code: string;
  rate: string;
}

export class OnlineSaleApprovalDto {
  enabled: boolean;
  approvedAt: string | null;
  approvedBy: NamedRefDto | null;
}

export class ProductDetailDto extends ProductListItemDto {
  shortDescription: string | null;
  description: string | null;
  subcategory: NamedRefDto | null;
  manufacturer: NamedRefDto | null;
  activeIngredients: NamedRefDto[];
  tags: NamedRefDto[];
  sanitaryRegistration: string | null;
  /** AAAA-MM-DD. */
  sanitaryRegistrationExpiresAt: string | null;
  taxRate: TaxRateRefDto;
  lowStockThreshold: number;
  onlineSale: OnlineSaleApprovalDto;
  images: ProductImageDto[];
  createdAt: string;
  updatedAt: string;
}

export class ProductOptionDto {
  id: string;
  sku: string;
  name: string;
}
