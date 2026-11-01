import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * TOTP según RFC 6238 (HMAC-SHA1, 6 dígitos, pasos de 30 s), compatible con
 * Google Authenticator, Microsoft Authenticator, Authy, etc.
 */
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/[\s=-]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Secreto base32 inválido');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Secreto aleatorio de 160 bits, codificado en base32. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function currentStep(now = Date.now()): number {
  return Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);
}

/** Código de 6 dígitos para un paso de tiempo (HOTP del RFC 4226). */
export function totpCode(secret: string | Buffer, step: number): string {
  const key = typeof secret === 'string' ? base32Decode(secret) : secret;
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

/**
 * Verifica un código aceptando ±`window` pasos por desfase de reloj. Devuelve
 * el paso que coincidió (para impedir su reutilización) o null.
 */
export function verifyTotp(
  secret: string,
  code: string,
  now = Date.now(),
  window = 1,
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const step = currentStep(now);
  for (let offset = -window; offset <= window; offset++) {
    const expected = totpCode(secret, step + offset);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(code))) {
      return step + offset;
    }
  }
  return null;
}

/** URI `otpauth://` que las apps autenticadoras leen desde el código QR. */
export function otpauthUri(
  issuer: string,
  account: string,
  secret: string,
): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params}`;
}
