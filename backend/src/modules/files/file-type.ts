/**
 * Detección del tipo real de un archivo por su firma (primeros bytes). No se
 * confía en el nombre ni en el Content-Type que envía el navegador.
 */
export interface DetectedType {
  mimeType: string;
  extension: string;
}

const SIGNATURES: Array<{
  type: DetectedType;
  matches: (b: Buffer) => boolean;
}> = [
  {
    type: { mimeType: 'image/jpeg', extension: 'jpg' },
    matches: (b) =>
      b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    type: { mimeType: 'image/png', extension: 'png' },
    matches: (b) =>
      b.length > 8 &&
      b
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    type: { mimeType: 'image/webp', extension: 'webp' },
    matches: (b) =>
      b.length > 12 &&
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  {
    type: { mimeType: 'application/pdf', extension: 'pdf' },
    matches: (b) =>
      b.length > 5 && b.subarray(0, 5).toString('ascii') === '%PDF-',
  },
];

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const DOCUMENT_TYPES = [...IMAGE_TYPES, 'application/pdf'] as const;

export function detectFileType(content: Buffer): DetectedType | null {
  return SIGNATURES.find((s) => s.matches(content))?.type ?? null;
}
