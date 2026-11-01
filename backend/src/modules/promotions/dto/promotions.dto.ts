import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import {
  IsOptionalText,
  IsRequiredText,
} from '../../../common/validation/validators.js';
import { PromotionType } from '../../../generated/prisma/enums.js';

const IsPromotionValue = () =>
  Matches(/^(?!0+(\.0{1,2})?$)\d{1,10}(\.\d{1,2})?$/, {
    message: 'El valor debe ser mayor que cero y tener hasta 2 decimales',
  });

export class PromotionInputDto {
  @IsRequiredText(150) name: string;
  @IsOptional() @IsOptionalText(500) description?: string | null;

  @ApiProperty({ enum: PromotionType, enumName: 'PromotionType' })
  @IsEnum(PromotionType)
  type: PromotionType;

  /** Porcentaje (1–100) o monto en quetzales por unidad. */
  @IsPromotionValue() value: string;

  /** Fecha y hora ISO 8601 con zona (p. ej. 2027-01-01T00:00:00-06:00). */
  @IsDateString() startsAt: string;
  @IsDateString() endsAt: string;

  @IsOptional() @IsBoolean() isActive?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  productIds: string[];
}

export class UpdatePromotionDto {
  @IsOptional() @IsRequiredText(150) name?: string;
  @IsOptional() @IsOptionalText(500) description?: string | null;

  @ApiProperty({
    enum: PromotionType,
    enumName: 'PromotionType',
    required: false,
  })
  @IsOptional()
  @IsEnum(PromotionType)
  type?: PromotionType;

  @IsOptional() @IsPromotionValue() value?: string;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  productIds?: string[];
}

export const PROMOTION_STATES = [
  'ACTIVE',
  'SCHEDULED',
  'EXPIRED',
  'INACTIVE',
] as const;
export type PromotionState = (typeof PROMOTION_STATES)[number];

export class PromotionsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(PROMOTION_STATES)
  state?: PromotionState;
}

export class PromotionProductDto {
  id: string;
  sku: string;
  name: string;
  price: string;
}

export class PromotionDto {
  id: string;
  name: string;
  description: string | null;
  @ApiProperty({ enum: PromotionType, enumName: 'PromotionType' })
  type: PromotionType;
  value: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  @ApiProperty({ enum: PROMOTION_STATES, enumName: 'PromotionState' })
  state: PromotionState;
  products: PromotionProductDto[];
  createdAt: string;
}

export class PromotionPageDto {
  items: PromotionDto[];
  total: number;
  page: number;
  pageSize: number;
}
