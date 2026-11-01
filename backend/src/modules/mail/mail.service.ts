import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import {
  MailTransport,
  type EnvironmentVariables,
} from '../../config/env.validation.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Envío de correo detrás de una interfaz mínima para poder cambiar de
 * proveedor. En la Fase 9 se agrega la bandeja de salida con reintentos.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly from: string;
  private readonly transporter?: Transporter;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.from = config.get('MAIL_FROM', { infer: true });
    if (config.get('MAIL_TRANSPORT', { infer: true }) === MailTransport.Smtp) {
      const user = config.get('SMTP_USER', { infer: true });
      this.transporter = createTransport({
        host: config.get('SMTP_HOST', { infer: true }),
        port: config.get('SMTP_PORT', { infer: true }),
        secure: config.get('SMTP_SECURE', { infer: true }),
        auth: user
          ? { user, pass: config.get('SMTP_PASSWORD', { infer: true }) }
          : undefined,
      });
    }
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transporter) {
      // Transporte "log": solo se permite fuera de producción (ver env.validation).
      this.logger.log(
        `Correo para ${message.to} · ${message.subject}\n${message.text}`,
      );
      return;
    }
    await this.transporter.sendMail({ from: this.from, ...message });
  }

  /**
   * Envía sin propagar errores: una falla del correo nunca debe revertir la
   * operación de negocio que lo originó.
   */
  async sendSafely(message: MailMessage): Promise<void> {
    try {
      await this.send(message);
    } catch (error) {
      this.logger.error(
        `No se pudo enviar el correo "${message.subject}" a ${message.to}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
