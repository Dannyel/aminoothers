import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import {
  IsNormalizedEmail,
  IsPhone,
  IsRequiredText,
} from '../../../common/validation/validators.js';
import { UserStatus } from '../../../generated/prisma/enums.js';

export class ListUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(UserStatus)
  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus', required: false })
  status?: UserStatus;
}

export class CreateStaffUserDto {
  @IsNormalizedEmail()
  email: string;

  @IsRequiredText(100)
  firstName: string;

  @IsRequiredText(100)
  lastName: string;

  @IsOptional()
  @IsPhone()
  phone?: string;

  /** Roles asignados. Puede quedar vacío. */
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  roleIds: string[];
}

export class UpdateStaffUserDto {
  @IsOptional()
  @IsRequiredText(100)
  firstName?: string;

  @IsOptional()
  @IsRequiredText(100)
  lastName?: string;

  @IsOptional()
  @IsPhone()
  phone?: string;
}

export class SetUserRolesDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  roleIds: string[];
}

export class SetUserStatusDto {
  @IsEnum(UserStatus)
  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus' })
  status: UserStatus;
}

export class RoleSummaryDto {
  id: string;
  code: string;
  name: string;
}

export class StaffUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  @ApiProperty({ enum: UserStatus, enumName: 'UserStatus' })
  status: UserStatus;
  roles: RoleSummaryDto[];
  /** Bloqueo temporal por intentos fallidos (ISO 8601), si está vigente. */
  lockedUntil: string | null;
  lastLoginAt: string | null;
  /** Configuró su app autenticadora. */
  mfaEnabled: boolean;
  createdAt: string;
}

export class StaffUserPageDto {
  items: StaffUserDto[];
  total: number;
  page: number;
  pageSize: number;
}
