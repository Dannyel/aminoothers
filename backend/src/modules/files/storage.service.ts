import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { EnvironmentVariables } from '../../config/env.validation.js';

/**
 * Almacenamiento en disco local. Es la única pieza que conoce el disco: para
 * pasar a S3 u otro servicio basta con otra implementación de estos métodos.
 */
@Injectable()
export class StorageService {
  private readonly root: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.root = resolve(config.get('UPLOAD_DIR', { infer: true }));
  }

  async save(key: string, content: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    // wx: nunca sobrescribe un archivo existente.
    await writeFile(path, content, { flag: 'wx' });
  }

  read(key: string): ReadStream {
    return createReadStream(this.pathFor(key));
  }

  async remove(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  /** Impide que una clave salga del directorio raíz (p. ej. con "../"). */
  private pathFor(key: string): string {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) {
      throw new Error(`Clave de almacenamiento inválida: ${key}`);
    }
    return path;
  }
}
