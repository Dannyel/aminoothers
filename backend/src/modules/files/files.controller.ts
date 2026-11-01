import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../common/decorators/auth.decorators.js';
import { FilesService } from './files.service.js';

@ApiTags('Archivos')
@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  /** Archivos públicos (imágenes de productos y categorías). */
  @Public()
  @SkipThrottle()
  @Get(':id')
  @ApiOkResponse({ description: 'Contenido del archivo' })
  async getPublic(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { file, stream } = await this.files.openPublic(id);
    res.set({
      'Content-Type': file.mimeType,
      'Content-Length': String(file.sizeBytes),
      // El contenido de un id nunca cambia: una imagen nueva es otro archivo.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': 'inline',
      ETag: `"${file.sha256}"`,
    });
    return new StreamableFile(stream);
  }
}
