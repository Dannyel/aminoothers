import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const trim = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);

/** Texto obligatorio: se recorta y no puede quedar vacío. */
export const IsRequiredText = (max: number) =>
  applyDecorators(trim, IsString(), IsNotEmpty(), MaxLength(max));

/** Correo electrónico normalizado a minúsculas. */
export const IsNormalizedEmail = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim().toLowerCase() : value,
    ),
    IsEmail({}, { message: 'Ingrese un correo electrónico válido' }),
    MaxLength(254),
  );

/** Política de contraseñas: 10 a 128 caracteres con al menos una letra y un número. */
export const IsPassword = () =>
  applyDecorators(
    IsString(),
    MinLength(10, {
      message: 'La contraseña debe tener al menos 10 caracteres',
    }),
    MaxLength(128, {
      message: 'La contraseña no puede superar 128 caracteres',
    }),
    Matches(/\p{L}/u, {
      message: 'La contraseña debe incluir al menos una letra',
    }),
    Matches(/\d/, { message: 'La contraseña debe incluir al menos un número' }),
  );

/** Teléfono: dígitos, espacios, guiones, paréntesis y "+", entre 8 y 20 caracteres. */
export const IsPhone = () =>
  applyDecorators(
    trim,
    IsString(),
    Matches(/^[0-9+\-\s()]{8,20}$/, { message: 'Ingrese un teléfono válido' }),
  );

/**
 * NIT guatemalteco o "CF". Solo se valida el formato (dígitos con dígito
 * verificador numérico o K); la verificación contra SAT llega con FEL.
 */
export const IsNit = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string'
        ? value.replace(/[\s-]/g, '').toUpperCase()
        : value,
    ),
    IsString(),
    Matches(/^(CF|\d{1,12}[\dK])$/, {
      message:
        'Ingrese un NIT válido (solo números y K) o CF para consumidor final',
    }),
  );

/** Importe mayor o igual a cero con hasta 2 decimales, como texto ("25.50"). */
export const IsMoneyAmount = () =>
  applyDecorators(
    IsString(),
    Matches(/^\d{1,10}(\.\d{1,2})?$/, {
      message: 'El importe debe tener hasta 2 decimales (p. ej. 25.50)',
    }),
  );

/** Texto opcional: se recorta y una cadena vacía se guarda como null. */
export const IsOptionalText = (max: number) =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim() || null : value,
    ),
    ValidateIf((_, value) => value !== null),
    IsString(),
    MaxLength(max),
  );
