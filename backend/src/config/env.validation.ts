import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export enum MailTransport {
  /** Envío real por SMTP. Obligatorio en producción. */
  Smtp = 'smtp',
  /** Solo desarrollo y pruebas: el correo se escribe en el log. */
  Log = 'log',
}

/**
 * La conversión implícita de class-transformer haría Boolean('false') === true,
 * así que los booleanos se interpretan antes de validar. Un valor que no sea
 * 'true'/'false' se deja tal cual para que @IsBoolean lo rechace.
 */
function parseBoolean(value: unknown, fallback: boolean): unknown {
  if (value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return value;
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @Matches(/^postgres(ql)?:\/\//, {
    message: 'DATABASE_URL debe ser una cadena de conexión de PostgreSQL',
  })
  DATABASE_URL: string;

  /** Orígenes permitidos para CORS, separados por coma. */
  @IsString()
  @IsNotEmpty()
  CORS_ORIGINS: string;

  /**
   * Valor de `trust proxy` de Express. El BFF (SvelteKit) reenvía la IP del
   * cliente en X-Forwarded-For; solo se confía en ella si viene de este origen.
   */
  @IsString()
  @IsNotEmpty()
  TRUST_PROXY: string = 'loopback';

  /** URL pública del frontend, para los enlaces de los correos. */
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  FRONTEND_URL: string;

  /** Por defecto Swagger solo se expone fuera de producción. */
  @IsBoolean()
  SWAGGER_ENABLED: boolean;

  /** Ventana del rate limiting global, en milisegundos. */
  @IsInt()
  @Min(1000)
  THROTTLE_TTL_MS: number = 60_000;

  /** Peticiones permitidas por IP dentro de la ventana. */
  @IsInt()
  @Min(1)
  THROTTLE_LIMIT: number = 120;

  /** Peticiones por IP y minuto en login, registro y recuperación. */
  @IsInt()
  @Min(1)
  AUTH_THROTTLE_LIMIT: number = 10;

  // ─── Autenticación ─────────────────────────────────────────────────────────

  @IsString()
  @MinLength(32, {
    message: 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres',
  })
  JWT_ACCESS_SECRET: string;

  @IsInt()
  @Min(60)
  @Max(3600)
  JWT_ACCESS_TTL_SECONDS: number = 900;

  @IsInt()
  @Min(1)
  REFRESH_TTL_CUSTOMER_DAYS: number = 30;

  @IsInt()
  @Min(1)
  REFRESH_TTL_STAFF_HOURS: number = 12;

  @IsInt()
  @Min(3)
  AUTH_MAX_FAILED_LOGINS: number = 5;

  @IsInt()
  @Min(1)
  AUTH_LOCK_MINUTES: number = 15;

  /** Clave AES-256 (64 caracteres hexadecimales) para cifrar los secretos TOTP. */
  @Matches(/^[0-9a-fA-F]{64}$/, {
    message: 'TOTP_ENCRYPTION_KEY debe tener 64 caracteres hexadecimales',
  })
  TOTP_ENCRYPTION_KEY: string;

  /** Nombre que muestran las apps autenticadoras. */
  @IsString()
  @IsNotEmpty()
  MFA_ISSUER: string = 'Farmacia en línea';

  // ─── Archivos ──────────────────────────────────────────────────────────────

  /** Directorio donde se guardan los archivos cargados (fuera del código). */
  @IsString()
  @IsNotEmpty()
  UPLOAD_DIR: string = './storage/uploads';

  /** Tamaño máximo de una imagen, en megabytes. */
  @IsInt()
  @Min(1)
  @Max(20)
  MAX_IMAGE_UPLOAD_MB: number = 5;

  /** Tamaño máximo de un comprobante de pago (imagen o PDF), en megabytes. */
  @IsInt()
  @Min(1)
  @Max(20)
  MAX_PROOF_UPLOAD_MB: number = 5;

  // ─── Pedidos ───────────────────────────────────────────────────────────────

  /** Cada cuántos segundos se vencen las reservas caducadas; 0 lo desactiva. */
  @IsInt()
  @Min(0)
  @Max(3600)
  RESERVATION_SWEEP_INTERVAL_SECONDS: number = 300;

  // ─── Notificaciones ────────────────────────────────────────────────────────

  /** Cada cuántos segundos se envían los correos pendientes; 0 lo desactiva. */
  @IsInt()
  @Min(0)
  @Max(3600)
  NOTIFICATION_DISPATCH_INTERVAL_SECONDS: number = 30;

  /** Hora (0–23, Guatemala) a partir de la cual se envía el resumen diario de inventario. */
  @IsInt()
  @Min(0)
  @Max(23)
  INVENTORY_DIGEST_HOUR: number = 7;

  // ─── Correo ────────────────────────────────────────────────────────────────

  @IsEnum(MailTransport)
  MAIL_TRANSPORT: MailTransport;

  @IsEmail({ allow_display_name: true })
  MAIL_FROM: string;

  @ValidateIf(
    (env: EnvironmentVariables) => env.MAIL_TRANSPORT === MailTransport.Smtp,
  )
  @IsString()
  @IsNotEmpty()
  SMTP_HOST?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT: number = 587;

  /** true = TLS implícito (puerto 465); false = STARTTLS. */
  @IsBoolean()
  SMTP_SECURE: boolean;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASSWORD?: string;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const isProduction = config.NODE_ENV === NodeEnv.Production;
  const booleans = {
    SWAGGER_ENABLED: parseBoolean(config.SWAGGER_ENABLED, !isProduction),
    SMTP_SECURE: parseBoolean(config.SMTP_SECURE, false),
  };
  const env = plainToInstance(
    EnvironmentVariables,
    {
      ...config,
      MAIL_TRANSPORT:
        config.MAIL_TRANSPORT ??
        (isProduction ? MailTransport.Smtp : MailTransport.Log),
    },
    { enableImplicitConversion: true },
  );
  // Se asignan después de la conversión implícita, que no debe tocar booleanos.
  Object.assign(env, booleans);

  const messages = validateSync(env, { skipMissingProperties: false }).flatMap(
    (error) => Object.values(error.constraints ?? {}),
  );
  if (isProduction && env.MAIL_TRANSPORT !== MailTransport.Smtp) {
    messages.push('MAIL_TRANSPORT debe ser smtp en producción');
  }
  if (messages.length > 0) {
    throw new Error(`Variables de entorno inválidas: ${messages.join('; ')}`);
  }
  return env;
}
