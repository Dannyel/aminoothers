import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import {
  IsNit,
  IsPhone,
  IsRequiredText,
} from '../../../common/validation/validators.js';
import { UserStatus } from '../../../generated/prisma/enums.js';
import { GUATEMALA_DEPARTMENTS } from '../guatemala.js';

// ─── Perfil ──────────────────────────────────────────────────────────────────

export class UpdateProfileDto {
  @IsOptional()
  @IsRequiredText(100)
  firstName?: string;

  @IsOptional()
  @IsRequiredText(100)
  lastName?: string;

  @IsOptional()
  @IsPhone()
  phone?: string;

  /** NIT o CF. */
  @IsOptional()
  @IsNit()
  taxId?: string;

  /** Nombre para facturación. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  taxName?: string;

  /** Fecha (AAAA-MM-DD). */
  @IsOptional()
  @IsDateString({ strict: true })
  birthDate?: string;
}

export class CustomerProfileDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  emailVerified: boolean;
  taxId: string;
  taxName: string | null;
  /** AAAA-MM-DD. */
  birthDate: string | null;
}

// ─── Direcciones ─────────────────────────────────────────────────────────────

export class AddressInputDto {
  /** Nombre corto: Casa, Trabajo… */
  @IsRequiredText(50)
  label: string;

  @IsRequiredText(150)
  recipientName: string;

  @IsPhone()
  phone: string;

  @IsRequiredText(200)
  addressLine1: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  /** Zona, p. ej. "10". */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  zone?: string;

  @IsRequiredText(100)
  municipality: string;

  @IsIn(GUATEMALA_DEPARTMENTS, { message: 'Seleccione un departamento válido' })
  @ApiProperty({ enum: GUATEMALA_DEPARTMENTS })
  department: string;

  /** Indicaciones para el mensajero. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reference?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto {
  @IsOptional() @IsRequiredText(50) label?: string;
  @IsOptional() @IsRequiredText(150) recipientName?: string;
  @IsOptional() @IsPhone() phone?: string;
  @IsOptional() @IsRequiredText(200) addressLine1?: string;
  @IsOptional() @IsString() @MaxLength(200) addressLine2?: string;
  @IsOptional() @IsString() @MaxLength(20) zone?: string;
  @IsOptional() @IsRequiredText(100) municipality?: string;

  @IsOptional()
  @IsIn(GUATEMALA_DEPARTMENTS, { message: 'Seleccione un departamento válido' })
  @ApiProperty({ enum: GUATEMALA_DEPARTMENTS, required: false })
  department?: string;

  @IsOptional() @IsString() @MaxLength(300) reference?: string;
}

export class AddressDto {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  zone: string | null;
  municipality: string;
  department: string;
  reference: string | null;
  isDefault: boolean;
}

// ─── Administración ──────────────────────────────────────────────────────────

export class ListCustomersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(UserStatus)
  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus', required: false })
  status?: UserStatus;
}

export class SetCustomerStatusDto {
  @IsEnum(UserStatus)
  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus' })
  status: UserStatus;
}

export class CustomerSummaryDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus' })
  status: UserStatus;
  emailVerified: boolean;
  /** Configuró su app autenticadora. */
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export class CustomerPageDto {
  items: CustomerSummaryDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class CustomerDetailDto extends CustomerSummaryDto {
  taxId: string;
  taxName: string | null;
  birthDate: string | null;
  addresses: AddressDto[];
}
