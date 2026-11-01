import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsRequiredText } from '../../../common/validation/validators.js';

export class CreateCategoryDto {
  @IsRequiredText(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;
}

export class UpdateCategoryDto extends CreateCategoryDto {
  @IsOptional()
  @IsRequiredText(100)
  declare name: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateSubcategoryDto {
  @IsRequiredText(100)
  name: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;
}

export class UpdateSubcategoryDto extends CreateSubcategoryDto {
  @IsOptional()
  @IsRequiredText(100)
  declare name: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SubcategoryDto {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

export class CategoryDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** Id del archivo de imagen (se sirve en /files/:id). */
  imageFileId: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  subcategories: SubcategoryDto[];
}
