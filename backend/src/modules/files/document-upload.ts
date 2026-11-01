import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';

/** Límite duro de multer; el límite configurable lo aplica FilesService. */
const HARD_LIMIT_BYTES = 20 * 1024 * 1024;

/** Recibe un campo multipart `file` (imagen o PDF) en memoria, con campos de texto. */
export const DocumentUpload = (fields: Record<string, object> = {}) =>
  applyDecorators(
    UseInterceptors(
      FileInterceptor('file', {
        limits: { fileSize: HARD_LIMIT_BYTES, files: 1, fields: 10 },
      }),
    ),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['file', ...Object.keys(fields)],
        properties: {
          file: {
            type: 'string',
            format: 'binary',
            description: 'JPEG, PNG, WebP o PDF',
          },
          ...fields,
        },
      },
    }),
  );
