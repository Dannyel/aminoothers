import { Injectable, OnModuleInit } from '@nestjs/common';
import argon2 from 'argon2';
import { generateToken } from '../../common/utils/crypto.js';

/** Hash argon2id con los parámetros por defecto de la librería (m=64 MiB, t=3, p=4). */
@Injectable()
export class PasswordService implements OnModuleInit {
  /** Hash de una contraseña aleatoria para igualar tiempos cuando el usuario no existe. */
  private dummyHash = '';

  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.hash(generateToken());
  }

  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /** Consume el mismo tiempo que una verificación real; siempre falla. */
  async verifyDummy(password: string): Promise<false> {
    await this.verify(this.dummyHash, password);
    return false;
  }

  /** Hash de una contraseña que nadie conoce (cuentas invitadas sin contraseña aún). */
  unusableHash(): Promise<string> {
    return this.hash(generateToken());
  }
}
