import { createHash, randomBytes } from 'node:crypto';

/** Token aleatorio de 256 bits, apto para URL. Solo se guarda su hash. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 en hexadecimal (64 caracteres). */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
