import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { AuthTokensDto } from './auth-responses.dto.js';

// ─── Peticiones ──────────────────────────────────────────────────────────────

export class MfaTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  mfaToken: string;
}

export class TotpCodeDto {
  /** Código de 6 dígitos de la app autenticadora. */
  @Matches(/^\d{6}$/, { message: 'El código debe tener 6 dígitos' })
  code: string;
}

export class MfaConfirmDto extends MfaTokenDto {
  @Matches(/^\d{6}$/, { message: 'El código debe tener 6 dígitos' })
  code: string;
}

export class MfaVerifyDto extends MfaTokenDto {
  /** Código de 6 dígitos de la app autenticadora. */
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'El código debe tener 6 dígitos' })
  code?: string;

  /** Alternativa al código de la app (p. ej. ABCDE-FGHIJ). */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  recoveryCode?: string;
}

// ─── Respuestas ──────────────────────────────────────────────────────────────

/** Respuesta del inicio de sesión: falta el segundo factor. */
export class MfaChallengeDto {
  /** Token de un solo uso para completar el inicio de sesión (5 minutos). */
  mfaToken: string;
  /** true si el usuario aún no configuró su app autenticadora. */
  enrollmentRequired: boolean;
  /** ISO 8601. */
  expiresAt: string;
}

export class MfaEnrollmentDto {
  /** Secreto base32 para ingresarlo a mano si no se puede escanear el QR. */
  secret: string;
  /** Contenido del código QR. */
  otpauthUri: string;
}

export class RecoveryCodesDto {
  /** Se muestran una sola vez; cada uno sirve una vez. */
  recoveryCodes: string[];
}

export class AuthTokensWithRecoveryDto extends AuthTokensDto {
  /** Se muestran una sola vez; cada uno sirve una vez. */
  recoveryCodes: string[];
}

export class MfaStatusDto {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesRemaining: number;
}
