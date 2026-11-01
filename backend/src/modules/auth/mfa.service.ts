import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { generateToken, sha256 } from '../../common/utils/crypto.js';
import { SecretBox } from '../../common/utils/secret-box.js';
import {
  base32Encode,
  generateTotpSecret,
  otpauthUri,
  verifyTotp,
} from '../../common/utils/totp.js';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import type { Prisma, User } from '../../generated/prisma/client.js';
import { UserStatus, UserType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { writeAudit } from '../audit/audit-trail.js';
import { MailService } from '../mail/mail.service.js';
import { authMails } from './auth-mails.js';
import type {
  AuthTokensWithRecoveryDto,
  MfaChallengeDto,
  MfaEnrollmentDto,
  MfaStatusDto,
  RecoveryCodesDto,
} from './dto/mfa.dto.js';
import type { AuthTokensDto } from './dto/auth-responses.dto.js';
import { SessionService, type ClientMeta } from './session.service.js';
import { SessionTokensService } from './session-tokens.service.js';

export const MFA_CHALLENGE_TTL_MS = 5 * 60_000;
export const MFA_MAX_ATTEMPTS = 5;
export const RECOVERY_CODE_COUNT = 10;

const EXPIRED = 'La verificación venció. Inicie sesión de nuevo.';
const WRONG_CODE = 'El código no es correcto';

type Tx = Prisma.TransactionClient;

/**
 * Doble factor obligatorio con TOTP (app autenticadora) y códigos de
 * recuperación. Tras validar la contraseña se crea un desafío; la sesión solo
 * se emite al verificar el código o al terminar la configuración inicial.
 */
@Injectable()
export class MfaService {
  private readonly box: SecretBox;
  private readonly issuer: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: SessionTokensService,
    private readonly sessions: SessionService,
    private readonly mail: MailService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.box = new SecretBox(
      config.get('TOTP_ENCRYPTION_KEY', { infer: true }),
    );
    this.issuer = config.get('MFA_ISSUER', { infer: true });
  }

  // ─── Inicio de sesión ──────────────────────────────────────────────────────

  async createChallenge(
    user: Pick<User, 'id' | 'totpEnabledAt'>,
  ): Promise<MfaChallengeDto> {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + MFA_CHALLENGE_TTL_MS);
    await this.prisma.mfaChallenge.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt },
    });
    return {
      mfaToken: token,
      enrollmentRequired: user.totpEnabledAt === null,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Primer inicio de sesión: devuelve el secreto para la app autenticadora. Si
   * ya había uno pendiente se reutiliza, para que recargar la página no
   * invalide un código QR ya escaneado.
   */
  async startEnrollment(mfaToken: string): Promise<MfaEnrollmentDto> {
    const user = await this.challengeUser(mfaToken);
    if (user.totpEnabledAt) {
      throw new BadRequestException('El doble factor ya está configurado');
    }
    let secret = user.totpSecret ? this.box.decrypt(user.totpSecret) : null;
    if (!secret) {
      secret = generateTotpSecret();
      await this.prisma.user.update({
        where: { id: user.id },
        data: { totpSecret: this.box.encrypt(secret) },
      });
    }
    return { secret, otpauthUri: otpauthUri(this.issuer, user.email, secret) };
  }

  async confirmEnrollment(
    mfaToken: string,
    code: string,
    meta: ClientMeta,
  ): Promise<AuthTokensWithRecoveryDto> {
    const { user, recoveryCodes, failed } = await this.prisma.$transaction(
      async (tx) => {
        const challenge = await this.useAttempt(tx, mfaToken);
        if (challenge.user.totpEnabledAt || !challenge.user.totpSecret) {
          throw new BadRequestException(
            'Primero solicite el código QR de configuración',
          );
        }
        const step = verifyTotp(
          this.box.decrypt(challenge.user.totpSecret),
          code,
        );
        if (step === null)
          return { user: null, recoveryCodes: [], failed: challenge.user };
        await tx.user.update({
          where: { id: challenge.user.id },
          data: { totpEnabledAt: new Date(), totpLastStep: step },
        });
        await this.consume(tx, challenge.id);
        return {
          user: challenge.user,
          recoveryCodes: await this.replaceRecoveryCodes(tx, challenge.user.id),
          failed: null,
        };
      },
    );
    if (!user) {
      await this.auditLogin(failed, 'LOGIN_FAILED', { step: 'mfa-enrollment' });
      throw new UnauthorizedException(WRONG_CODE);
    }
    await this.auditLogin(user, 'LOGIN', { method: 'mfa-enrollment' });
    const tokens = await this.tokens.startSession(user.id, user.type, meta);
    return Object.assign(tokens, { recoveryCodes });
  }

  /** Segundo paso del inicio de sesión: código de la app o código de recuperación. */
  async verify(
    mfaToken: string,
    input: { code?: string; recoveryCode?: string },
    meta: ClientMeta,
  ): Promise<AuthTokensDto> {
    if (!input.code === !input.recoveryCode) {
      throw new BadRequestException(
        'Ingrese el código de la app o un código de recuperación',
      );
    }
    const { user, failed } = await this.prisma.$transaction(async (tx) => {
      const challenge = await this.useAttempt(tx, mfaToken);
      if (!challenge.user.totpEnabledAt || !challenge.user.totpSecret) {
        throw new BadRequestException('Debe configurar el doble factor');
      }
      const ok = input.code
        ? await this.acceptTotp(tx, challenge.user, input.code)
        : await this.useRecoveryCode(
            tx,
            challenge.user.id,
            input.recoveryCode!,
          );
      if (!ok) return { user: null, failed: challenge.user };
      await this.consume(tx, challenge.id);
      return { user: challenge.user, failed: null };
    });
    const method = input.code ? 'totp' : 'recovery-code';
    if (!user) {
      await this.auditLogin(failed, 'LOGIN_FAILED', { step: 'mfa', method });
      throw new UnauthorizedException(WRONG_CODE);
    }
    await this.auditLogin(user, 'LOGIN', { method });
    return this.tokens.startSession(user.id, user.type, meta);
  }

  // ─── Cuenta autenticada ────────────────────────────────────────────────────

  async status(userId: string): Promise<MfaStatusDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const remaining = await this.prisma.recoveryCode.count({
      where: { userId, usedAt: null },
    });
    return {
      enabled: user.totpEnabledAt !== null,
      enabledAt: user.totpEnabledAt?.toISOString() ?? null,
      recoveryCodesRemaining: remaining,
    };
  }

  /** Genera códigos de recuperación nuevos; exige un código vigente de la app. */
  async regenerateRecoveryCodes(
    principal: AuthUser,
    code: string,
  ): Promise<RecoveryCodesDto> {
    const recoveryCodes = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: principal.id },
      });
      if (!(await this.acceptTotp(tx, user, code))) return null;
      return this.replaceRecoveryCodes(tx, user.id);
    });
    if (!recoveryCodes) throw new BadRequestException(WRONG_CODE);
    return { recoveryCodes };
  }

  /**
   * Restablecimiento administrativo (pérdida del teléfono y de los códigos):
   * el usuario deberá configurar el doble factor en su próximo inicio de sesión.
   */
  async resetForUser(actor: AuthUser, userId: string): Promise<void> {
    if (actor.id === userId) {
      throw new BadRequestException(
        'No puede restablecer su propio doble factor',
      );
    }
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    await this.prisma.$transaction([
      this.prisma.recoveryCode.deleteMany({ where: { userId } }),
      this.prisma.mfaChallenge.deleteMany({ where: { userId } }),
      this.prisma.user.update({
        where: { id: userId },
        data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null },
      }),
    ]);
    await this.sessions.revokeAllForUser(userId);
    await this.mail.sendSafely({
      to: user.email,
      ...authMails.mfaReset(user.firstName),
    });
  }

  // ─── Internos ──────────────────────────────────────────────────────────────

  /** Inicios de sesión del personal en la auditoría (los clientes no se registran). */
  private async auditLogin(
    user: Pick<User, 'id' | 'type' | 'email'> | null,
    action: 'LOGIN' | 'LOGIN_FAILED',
    details: Record<string, string>,
  ): Promise<void> {
    if (user?.type !== UserType.STAFF) return;
    await writeAudit(this.prisma, {
      userId: user.id,
      action,
      module: 'auth',
      changes: { email: user.email, ...details },
    });
  }

  private async challengeUser(mfaToken: string): Promise<User> {
    const challenge = await this.prisma.mfaChallenge.findUnique({
      where: { tokenHash: sha256(mfaToken) },
      include: { user: true },
    });
    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.expiresAt <= new Date() ||
      challenge.attempts >= MFA_MAX_ATTEMPTS ||
      challenge.user.status !== UserStatus.ACTIVE
    ) {
      throw new UnauthorizedException(EXPIRED);
    }
    return challenge.user;
  }

  /**
   * Registra un intento sobre el desafío (actualización condicional, segura
   * ante peticiones simultáneas). Agotados los intentos hay que volver a
   * ingresar la contraseña.
   */
  private async useAttempt(tx: Tx, mfaToken: string) {
    const tokenHash = sha256(mfaToken);
    const { count } = await tx.mfaChallenge.updateMany({
      where: {
        tokenHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: MFA_MAX_ATTEMPTS },
      },
      data: { attempts: { increment: 1 } },
    });
    const challenge =
      count === 1
        ? await tx.mfaChallenge.findUnique({
            where: { tokenHash },
            include: { user: true },
          })
        : null;
    if (!challenge || challenge.user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(EXPIRED);
    }
    return challenge;
  }

  private async consume(tx: Tx, challengeId: string): Promise<void> {
    await tx.mfaChallenge.update({
      where: { id: challengeId },
      data: { consumedAt: new Date() },
    });
  }

  /** Acepta el código si es válido y no se usó antes (un paso de tiempo, un uso). */
  private async acceptTotp(tx: Tx, user: User, code: string): Promise<boolean> {
    if (!user.totpSecret) return false;
    const step = verifyTotp(this.box.decrypt(user.totpSecret), code);
    if (step === null) return false;
    const { count } = await tx.user.updateMany({
      where: {
        id: user.id,
        OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }],
      },
      data: { totpLastStep: step },
    });
    return count === 1;
  }

  private async useRecoveryCode(
    tx: Tx,
    userId: string,
    code: string,
  ): Promise<boolean> {
    const { count } = await tx.recoveryCode.updateMany({
      where: {
        userId,
        codeHash: sha256(normalizeRecoveryCode(code)),
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });
    return count === 1;
  }

  private async replaceRecoveryCodes(
    tx: Tx,
    userId: string,
  ): Promise<string[]> {
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => {
      const raw = base32Encode(randomBytes(7)).slice(0, 10);
      return `${raw.slice(0, 5)}-${raw.slice(5)}`;
    });
    await tx.recoveryCode.deleteMany({ where: { userId } });
    await tx.recoveryCode.createMany({
      data: codes.map((code) => ({
        userId,
        codeHash: sha256(normalizeRecoveryCode(code)),
      })),
    });
    return codes;
  }
}

/** Mayúsculas y sin espacios ni guiones, para que el formato de escritura no importe. */
export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}
