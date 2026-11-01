import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import {
  MailService,
  type MailMessage,
} from '../../src/modules/mail/mail.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

/** Sustituto de MailService que guarda los correos para inspeccionarlos. */
export class RecordingMailService {
  readonly messages: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.messages.push(message);
  }

  async sendSafely(message: MailMessage): Promise<void> {
    this.messages.push(message);
  }

  /** Último correo enviado a la dirección. */
  lastTo(email: string): MailMessage | undefined {
    return this.messages.filter((m) => m.to === email.toLowerCase()).at(-1);
  }

  /** Token del enlace (?token=...) del último correo enviado a la dirección. */
  tokenFor(email: string): string {
    const token = this.lastTo(email)?.text.match(/[?&]token=([\w-]+)/)?.[1];
    if (!token) throw new Error(`No hay correo con enlace para ${email}`);
    return token;
  }

  clear(): void {
    this.messages.length = 0;
  }
}

export interface TestContext {
  app: NestExpressApplication;
  prisma: PrismaService;
  mail: RecordingMailService;
}

/** Levanta la aplicación real (misma configuración que main.ts) contra la BD de prueba. */
export async function createTestApp(): Promise<TestContext> {
  const mail = new RecordingMailService();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue(mail)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService), mail };
}
