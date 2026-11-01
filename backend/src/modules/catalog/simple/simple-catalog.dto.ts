import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import { IsRequiredText } from '../../../common/validation/validators.js';

/** Catálogos simples (nombre + estado). La clave es el segmento de la URL. */
export const SIMPLE_CATALOG_KINDS = [
  'brands',
  'manufacturers',
  'presentations',
  'concentrations',
  'active-ingredients',
  'tags',
] as const;

export type SimpleCatalogKind = (typeof SIMPLE_CATALOG_KINDS)[number];

export class SimpleCatalogListQueryDto extends PaginationQueryDto {
  /** active (por defecto), inactive o all. */
  @IsOptional()
  @IsIn(['active', 'inactive', 'all'])
  @ApiProperty({ enum: ['active', 'inactive', 'all'], required: false })
  status: 'active' | 'inactive' | 'all' = 'active';
}

export class CreateSimpleCatalogItemDto {
  @IsRequiredText(150)
  name: string;
}

export class UpdateSimpleCatalogItemDto {
  @IsOptional()
  @IsRequiredText(150)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SimpleCatalogItemDto {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  /** Productos vigentes que lo usan. */
  productCount: number;
}

export class SimpleCatalogPageDto {
  items: SimpleCatalogItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class CatalogOptionDto {
  id: string;
  name: string;
}
