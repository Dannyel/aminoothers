import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Cifrado simétrico AES-256-GCM para secretos que deben recuperarse (p. ej. el
 * secreto TOTP). Formato: base64url(iv).base64url(tag).base64url(cifrado).
 */
export class SecretBox {
  private readonly key: Buffer;

  /** @param hexKey 32 bytes en hexadecimal (64 caracteres). */
  constructor(hexKey: string) {
    this.key = Buffer.from(hexKey, 'hex');
    if (this.key.length !== 32) throw new Error('La clave debe tener 32 bytes');
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), data]
      .map((b) => b.toString('base64url'))
      .join('.');
  }

  decrypt(sealed: string): string {
    const [iv, tag, data] = sealed
      .split('.')
      .map((p) => Buffer.from(p, 'base64url'));
    if (!iv || !tag || !data)
      throw new Error('Secreto cifrado con formato inválido');
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      'utf8',
    );
  }
}
