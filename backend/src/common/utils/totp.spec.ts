import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  otpauthUri,
  totpCode,
  verifyTotp,
} from './totp.js';

// Vectores del RFC 6238, apéndice B (SHA-1, clave ASCII "12345678901234567890").
// El RFC publica 8 dígitos; los 6 últimos son el código de 6 dígitos.
const RFC_KEY = Buffer.from('12345678901234567890');
const RFC_VECTORS: Array<[number, string]> = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
  [20000000000, '65353130'],
];

describe('TOTP', () => {
  it.each(RFC_VECTORS)('cumple el RFC 6238 en t=%i', (seconds, expected) => {
    expect(totpCode(RFC_KEY, Math.floor(seconds / 30))).toBe(
      expected.slice(-6),
    );
  });

  it('codifica y decodifica base32 sin pérdida', () => {
    expect(base32Encode(RFC_KEY)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(base32Decode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')).toEqual(RFC_KEY);
  });

  it('verifica con tolerancia de un paso y devuelve el paso usado', () => {
    const secret = generateTotpSecret();
    const now = 1_800_000_000_000;
    const step = Math.floor(now / 30_000);
    expect(verifyTotp(secret, totpCode(secret, step), now)).toBe(step);
    expect(verifyTotp(secret, totpCode(secret, step - 1), now)).toBe(step - 1);
    expect(verifyTotp(secret, totpCode(secret, step + 2), now)).toBeNull();
  });

  it('rechaza códigos mal formados', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, '12345')).toBeNull();
    expect(verifyTotp(secret, 'abcdef')).toBeNull();
  });

  it('arma la URI otpauth para el código QR', () => {
    expect(otpauthUri('Farmacia', 'ana@prueba.gt', 'ABC')).toBe(
      'otpauth://totp/Farmacia%3Aana%40prueba.gt?secret=ABC&issuer=Farmacia&algorithm=SHA1&digits=6&period=30',
    );
  });
});
