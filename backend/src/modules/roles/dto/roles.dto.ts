import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { IsRequiredText } from '../../../common/validation/validators.js';

export class CreateRoleDto {
  /** Identificador en mayúsculas, p. ej. CAJERO. No se puede cambiar después. */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z][A-Z0-9_]{1,49}$/, {
    message: 'El código debe usar letras mayúsculas, números y guion bajo',
  })
  code: string;

  @IsRequiredText(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  permissions: string[];
}

export class UpdateRoleDto {
  @IsOptional()
  @IsRequiredText(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  permissions?: string[];
}

export class RoleDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  /** SUPER_ADMIN: tiene todos los permisos y no se puede editar. */
  isSuperAdmin: boolean;
  permissions: string[];
  userCount: number;
}

export class PermissionDto {
  code: string;
  module: string;
  description: string;
}
