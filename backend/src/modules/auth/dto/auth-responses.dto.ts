import { ApiProperty } from '@nestjs/swagger';
import { UserType } from '../../../generated/prisma/enums.js';

export class MeResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  @ApiProperty({ enum: UserType, enumName: 'UserType' })
  type: UserType;
  emailVerified: boolean;
  /** Doble factor configurado. */
  mfaEnabled: boolean;
  /** Códigos de rol (solo personal). */
  roles: string[];
  /** Permisos efectivos (solo personal; el superadministrador recibe todos). */
  permissions: string[];
}

export class AuthTokensDto {
  accessToken: string;
  /** ISO 8601. */
  accessTokenExpiresAt: string;
  refreshToken: string;
  /** ISO 8601. */
  refreshTokenExpiresAt: string;
  user: MeResponseDto;
}

export class MessageResponseDto {
  message: string;
}

export class PasswordResetResponseDto extends MessageResponseDto {
  /** Para que el frontend ofrezca el inicio de sesión correcto (tienda o panel). */
  @ApiProperty({ enum: UserType, enumName: 'UserType' })
  type: UserType;
}
