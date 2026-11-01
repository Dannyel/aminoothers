import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import type { ReadStream } from 'node:fs';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import type {
  File as StoredFile,
  Prisma,
} from '../../generated/prisma/client.js';
import { FilePurpose } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { detectFileType, DOCUMENT_TYPES, IMAGE_TYPES } from './file-type.js';
import { StorageService } from './storage.service.js';

export interface UploadedContent {
  buffer: Buffer;
  originalname: string;
  size: number;
}

/** Carpeta de almacenamiento por propósito. */
const FOLDERS: Record<FilePurpose, string> = {
  [FilePurpose.PRODUCT_IMAGE]: 'products',
  [FilePurpose.CATEGORY_IMAGE]: 'categories',
  [FilePurpose.PAYMENT_PROOF]: 'payment-proofs',
  [FilePurpose.PRESCRIPTION]: 'prescriptions',
  [FilePurpose.LOGO]: 'branding',
  [FilePurpose.FEL_DOCUMENT]: 'fel',
};

@Injectable()
export class FilesService {
  private readonly maxImageBytes: number;
  private readonly maxProofBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.maxImageBytes =
      config.get('MAX_IMAGE_UPLOAD_MB', { infer: true }) * 1024 * 1024;
    this.maxProofBytes =
      config.get('MAX_PROOF_UPLOAD_MB', { infer: true }) * 1024 * 1024;
  }

  get imageLimitBytes(): number {
    return this.maxImageBytes;
  }

  /**
   * Guarda una imagen pública (JPEG, PNG o WebP). El tipo se valida por el
   * contenido, el nombre en disco es aleatorio y el registro queda en `files`.
   */
  async saveImage(
    upload: UploadedContent | undefined,
    purpose: FilePurpose,
    uploadedById: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<StoredFile> {
    if (!upload?.buffer?.length)
      throw new BadRequestException('Adjunte una imagen');
    if (upload.size > this.maxImageBytes) {
      throw new PayloadTooLargeException(
        `La imagen supera el máximo de ${this.maxImageBytes / 1024 / 1024} MB`,
      );
    }
    const type = detectFileType(upload.buffer);
    if (!type || !(IMAGE_TYPES as readonly string[]).includes(type.mimeType)) {
      throw new BadRequestException('La imagen debe ser JPEG, PNG o WebP');
    }

    const storageKey = `${FOLDERS[purpose]}/${randomUUID()}.${type.extension}`;
    await this.storage.save(storageKey, upload.buffer);
    try {
      return await tx.file.create({
        data: {
          storageKey,
          originalName: upload.originalname.slice(0, 255) || 'imagen',
          mimeType: type.mimeType,
          sizeBytes: upload.size,
          sha256: createHash('sha256').update(upload.buffer).digest('hex'),
          purpose,
          isPublic: true,
          uploadedById,
        },
      });
    } catch (error) {
      await this.storage.remove(storageKey);
      throw error;
    }
  }

  /**
   * Guarda un documento privado (comprobante de pago: JPEG, PNG, WebP o PDF).
   * Solo se sirve con autorización, nunca por /files/:id.
   */
  async savePrivateDocument(
    upload: UploadedContent | undefined,
    purpose: FilePurpose,
    uploadedById: string,
  ): Promise<StoredFile> {
    if (!upload?.buffer?.length)
      throw new BadRequestException('Adjunte el comprobante');
    if (upload.size > this.maxProofBytes) {
      throw new PayloadTooLargeException(
        `El archivo supera el máximo de ${this.maxProofBytes / 1024 / 1024} MB`,
      );
    }
    const type = detectFileType(upload.buffer);
    if (
      !type ||
      !(DOCUMENT_TYPES as readonly string[]).includes(type.mimeType)
    ) {
      throw new BadRequestException(
        'El comprobante debe ser una imagen JPEG, PNG o WebP, o un PDF',
      );
    }
    const storageKey = `${FOLDERS[purpose]}/${randomUUID()}.${type.extension}`;
    await this.storage.save(storageKey, upload.buffer);
    try {
      return await this.prisma.file.create({
        data: {
          storageKey,
          originalName: upload.originalname.slice(0, 255) || 'comprobante',
          mimeType: type.mimeType,
          sizeBytes: upload.size,
          sha256: createHash('sha256').update(upload.buffer).digest('hex'),
          purpose,
          isPublic: false,
          uploadedById,
        },
      });
    } catch (error) {
      await this.storage.remove(storageKey);
      throw error;
    }
  }

  /** Abre un archivo privado. Quien llama ya verificó el permiso. */
  async openPrivate(
    id: string,
  ): Promise<{ file: StoredFile; stream: ReadStream }> {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('Archivo no encontrado');
    return { file, stream: this.storage.read(file.storageKey) };
  }

  /** Archivo público para servirlo al navegador. */
  async openPublic(
    id: string,
  ): Promise<{ file: StoredFile; stream: ReadStream }> {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file || !file.isPublic)
      throw new NotFoundException('Archivo no encontrado');
    return { file, stream: this.storage.read(file.storageKey) };
  }

  /** Borra el registro y el contenido. Llamar solo cuando nada lo referencia. */
  async remove(file: Pick<StoredFile, 'id' | 'storageKey'>): Promise<void> {
    await this.prisma.file.delete({ where: { id: file.id } });
    await this.storage.remove(file.storageKey);
  }
}
