import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  IsMoneyAmount,
  IsOptionalText,
  IsRequiredText,
} from '../../../common/validation/validators.js';

// ─── Peticiones ──────────────────────────────────────────────────────────────

/** Datos de la farmacia y parámetros de pedidos. Todos los campos son opcionales. */
export class UpdateStoreSettingsDto {
  @IsOptional() @IsRequiredText(150) tradeName?: string;
  @IsOptional() @IsOptionalText(200) legalName?: string | null;

  /** NIT de la farmacia. */
  @IsOptional()
  @IsOptionalText(20)
  @Matches(/^\d{1,12}[\dK]$/, { message: 'Ingrese un NIT válido' })
  taxId?: string | null;

  @IsOptional() @IsOptionalText(300) fiscalAddress?: string | null;
  @IsOptional() @IsOptionalText(30) phone?: string | null;
  @IsOptional() @IsOptionalText(30) whatsapp?: string | null;

  @IsOptional()
  @IsOptionalText(254)
  @IsEmail({}, { message: 'Ingrese un correo electrónico válido' })
  email?: string | null;

  @IsOptional() @IsOptionalText(300) businessHours?: string | null;
  /** Licencia sanitaria del establecimiento. */
  @IsOptional() @IsOptionalText(100) sanitaryLicense?: string | null;
  /** Regente farmacéutico responsable. */
  @IsOptional() @IsOptionalText(150) regentName?: string | null;
  /** Leyenda regulatoria que se muestra en toda la tienda. */
  @IsOptional() @IsRequiredText(2000) regulatoryNotice?: string;

  /** Horas para pagar por transferencia antes de liberar la reserva (D3). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  transferReservationHours?: number;

  /** Horas para confirmar un pedido contra entrega (D3). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  codReservationHours?: number;

  /** Máximo de unidades de un producto por pedido. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxUnitsPerProduct?: number;

  /** Días desde la entrega para registrar una devolución (D7). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(90)
  returnWindowDays?: number;

  /** Buzón del personal: comprobantes por verificar y alertas de inventario. */
  @IsOptional()
  @IsOptionalText(254)
  @IsEmail({}, { message: 'Ingrese un correo electrónico válido' })
  staffAlertEmail?: string | null;
}

export class ShippingMethodInputDto {
  @IsRequiredText(100) name: string;
  @IsOptional() @IsOptionalText(300) description?: string | null;

  /** Costo para el cliente con IVA incluido; 0 = envío gratis. */
  @IsMoneyAmount() cost: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  estimatedDaysMin?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  estimatedDaysMax?: number | null;

  @IsOptional() @IsOptionalText(300) coverageNote?: string | null;
  @IsOptional() @IsBoolean() allowsCashOnDelivery?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;

  /** Mensajería que lo atiende (opcional). */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  courierId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}

export class UpdateShippingMethodDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  courierId?: string | null;

  @IsOptional() @IsRequiredText(100) name?: string;
  @IsOptional() @IsOptionalText(300) description?: string | null;
  @IsOptional() @IsMoneyAmount() cost?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  estimatedDaysMin?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  estimatedDaysMax?: number | null;

  @IsOptional() @IsOptionalText(300) coverageNote?: string | null;
  @IsOptional() @IsBoolean() allowsCashOnDelivery?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}

// ─── Respuestas ──────────────────────────────────────────────────────────────

/** Información pública de la farmacia (tienda). */
export class PublicStoreInfoDto {
  tradeName: string;
  legalName: string | null;
  taxId: string | null;
  fiscalAddress: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  businessHours: string | null;
  logoFileId: string | null;
  sanitaryLicense: string | null;
  regentName: string | null;
  regulatoryNotice: string;
}

export class StoreSettingsDto extends PublicStoreInfoDto {
  transferReservationHours: number;
  codReservationHours: number;
  maxUnitsPerProduct: number;
  returnWindowDays: number;
  staffAlertEmail: string | null;
  updatedAt: string;
}

export class ShippingMethodDto {
  id: string;
  name: string;
  description: string | null;
  /** Con IVA incluido. */
  cost: string;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  coverageNote: string | null;
  allowsCashOnDelivery: boolean;
  courierId: string | null;
  isActive: boolean;
  sortOrder: number;
}

// ─── Cuentas bancarias y mensajerías ────────────────────────────────────────

export class BankAccountInputDto {
  @IsRequiredText(100) bankName: string;

  @Matches(/^[0-9-]{4,50}$/, {
    message: 'El número de cuenta solo admite dígitos y guiones',
  })
  accountNumber: string;

  /** Monetaria, ahorro… */
  @IsRequiredText(30) accountType: string;
  @IsRequiredText(150) accountHolder: string;
  @IsOptional() @IsOptionalText(500) instructions?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}

export class UpdateBankAccountDto {
  @IsOptional() @IsRequiredText(100) bankName?: string;

  @IsOptional()
  @Matches(/^[0-9-]{4,50}$/, {
    message: 'El número de cuenta solo admite dígitos y guiones',
  })
  accountNumber?: string;

  @IsOptional() @IsRequiredText(30) accountType?: string;
  @IsOptional() @IsRequiredText(150) accountHolder?: string;
  @IsOptional() @IsOptionalText(500) instructions?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;
}

export class BankAccountDto {
  id: string;
  bankName: string;
  accountNumber: string;
  accountType: string;
  accountHolder: string;
  currency: string;
  instructions: string | null;
  isActive: boolean;
  sortOrder: number;
}

const TRACKING_TEMPLATE = /\{tracking\}/;

export class CourierInputDto {
  @IsRequiredText(100) name: string;
  @IsOptional() @IsOptionalText(30) phone?: string | null;

  @IsOptional()
  @IsOptionalText(200)
  @IsUrl(
    { protocols: ['https', 'http'] },
    { message: 'Ingrese una URL válida' },
  )
  website?: string | null;

  /** URL de rastreo con {tracking} en lugar del número de guía. */
  @IsOptional()
  @IsOptionalText(300)
  @Matches(TRACKING_TEMPLATE, {
    message: 'La URL de rastreo debe incluir {tracking}',
  })
  trackingUrlTemplate?: string | null;

  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateCourierDto {
  @IsOptional() @IsRequiredText(100) name?: string;
  @IsOptional() @IsOptionalText(30) phone?: string | null;

  @IsOptional()
  @IsOptionalText(200)
  @IsUrl(
    { protocols: ['https', 'http'] },
    { message: 'Ingrese una URL válida' },
  )
  website?: string | null;

  @IsOptional()
  @IsOptionalText(300)
  @Matches(TRACKING_TEMPLATE, {
    message: 'La URL de rastreo debe incluir {tracking}',
  })
  trackingUrlTemplate?: string | null;

  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CourierDto {
  id: string;
  name: string;
  phone: string | null;
  website: string | null;
  trackingUrlTemplate: string | null;
  isActive: boolean;
}
