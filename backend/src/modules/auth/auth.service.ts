import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../../common/auth/auth-user.js';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import type { User } from '../../generated/prisma/client.js';
import {
  UserStatus,
  UserTokenPurpose,
  UserType,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { writeAudit } from '../audit/audit-trail.js';
import { MailService } from '../mail/mail.service.js';
import { authMails } from './auth-mails.js';
import type {
  ChangePasswordDto,
  LoginDto,
  RegisterCustomerDto,
  ResetPasswordDto,
} from './dto/auth-requests.dto.js';
import type {
  AuthTokensDto,
  MeResponseDto,
  MessageResponseDto,
  PasswordResetResponseDto,
} from './dto/auth-responses.dto.js';
import type { MfaChallengeDto } from './dto/mfa.dto.js';
import { MfaService } from './mfa.service.js';
import { PasswordService } from './password.service.js';
import { SessionTokensService } from './session-tokens.service.js';
import { SessionService, type ClientMeta } from './session.service.js';
import {
  STAFF_INVITATION_TTL_MS,
  UserTokenService,
} from './user-token.service.js';

const INVALID_CREDENTIALS = 'Correo o contraseña incorrectos';

@Injectable()
export class AuthService {
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly tokens: UserTokenService,
    private readonly mail: MailService,
    private readonly sessionTokens: SessionTokensService,
    private readonly mfa: MfaService,
  ) {
    this.frontendUrl = config
      .get('FRONTEND_URL', { infer: true })
      .replace(/\/$/, '');
  }

  // ─── Registro y verificación ───────────────────────────────────────────────

  /**
   * Registra un cliente. La respuesta es la misma exista o no el correo, para
   * no revelar qué correos tienen cuenta; al dueño de una cuenta existente se
   * le avisa por correo.
   */
  async registerCustomer(
    dto: RegisterCustomerDto,
  ): Promise<MessageResponseDto> {
    const response = {
      message: 'Revise su correo electrónico para confirmar su cuenta.',
    };
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      await this.mail.sendSafely({
        to: existing.email,
        ...authMails.existingAccount(
          existing.firstName,
          `${this.frontendUrl}/login`,
          `${this.frontendUrl}/recuperar-contrasena`,
        ),
      });
      return response;
    }

    const passwordHash = await this.passwords.hash(dto.password);
    const { user, token } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          type: UserType.CUSTOMER,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          customer: { create: {} },
        },
      });
      const token = await this.tokens.issue(
        user.id,
        UserTokenPurpose.EMAIL_VERIFICATION,
        undefined,
        tx,
      );
      return { user, token };
    });
    await this.sendVerificationEmail(user, token);
    return response;
  }

  async verifyEmail(token: string): Promise<MessageResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      const userId = await this.tokens.consume(
        token,
        UserTokenPurpose.EMAIL_VERIFICATION,
        tx,
      );
      await tx.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date() },
      });
    });
    return { message: 'Su correo electrónico fue confirmado.' };
  }

  async resendVerification(principal: AuthUser): Promise<MessageResponseDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: principal.id },
    });
    if (user.emailVerifiedAt) {
      throw new BadRequestException('Su correo electrónico ya está confirmado');
    }
    const token = await this.tokens.issue(
      user.id,
      UserTokenPurpose.EMAIL_VERIFICATION,
    );
    await this.sendVerificationEmail(user, token);
    return { message: 'Le enviamos un nuevo enlace de confirmación.' };
  }

  // ─── Sesiones ──────────────────────────────────────────────────────────────

  /**
   * Primer paso del inicio de sesión. Con la contraseña correcta no se emite
   * la sesión: se devuelve un desafío que se completa con el doble factor.
   */
  async login(portal: UserType, dto: LoginDto): Promise<MfaChallengeDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      await this.passwords.verifyDummy(dto.password);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      const minutes = Math.ceil(
        (user.lockedUntil.getTime() - now.getTime()) / 60_000,
      );
      throw new UnauthorizedException(
        `Demasiados intentos fallidos. Intente de nuevo en ${minutes} minuto(s) o restablezca su contraseña.`,
      );
    }

    if (!(await this.passwords.verify(user.passwordHash, dto.password))) {
      const locked = await this.registerFailedLogin(user.id);
      if (user.type === UserType.STAFF) {
        await writeAudit(this.prisma, {
          userId: user.id,
          action: locked ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
          module: 'auth',
          changes: { email: user.email, step: 'password' },
        });
      }
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    // Una cuenta del otro portal se trata como credenciales incorrectas.
    if (user.type !== portal)
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(
        'Su cuenta está bloqueada o inactiva. Comuníquese con la farmacia.',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
    return this.mfa.createChallenge(user);
  }

  async refresh(
    refreshToken: string,
    meta: ClientMeta,
  ): Promise<AuthTokensDto> {
    const session = await this.sessions.rotate(refreshToken, meta);
    return this.sessionTokens.build(session.userId, session);
  }

  async logout(principal: AuthUser): Promise<void> {
    await this.sessions.revokeFamily(principal.sessionId);
  }

  async logoutAll(principal: AuthUser): Promise<void> {
    await this.sessions.revokeAllForUser(principal.id);
  }

  me(userId: string): Promise<MeResponseDto> {
    return this.sessionTokens.me(userId);
  }

  // ─── Contraseñas ───────────────────────────────────────────────────────────

  /** Siempre responde lo mismo para no revelar si el correo tiene cuenta. */
  async forgotPassword(email: string): Promise<MessageResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && user.status === UserStatus.ACTIVE) {
      await this.sendPasswordResetEmail(user);
    }
    return {
      message:
        'Si el correo está registrado, recibirá un enlace para restablecer su contraseña.',
    };
  }

  /**
   * Envía el enlace para definir contraseña. Con `invitation` se usa el texto
   * de alta de personal y una vigencia de 72 horas.
   */
  async sendPasswordResetEmail(
    user: Pick<User, 'id' | 'email' | 'firstName'>,
    options: { invitation?: boolean } = {},
  ): Promise<void> {
    const token = await this.tokens.issue(
      user.id,
      UserTokenPurpose.PASSWORD_RESET,
      options.invitation ? STAFF_INVITATION_TTL_MS : undefined,
    );
    const url = `${this.frontendUrl}/restablecer-contrasena?token=${token}`;
    await this.mail.sendSafely({
      to: user.email,
      ...(options.invitation
        ? authMails.staffInvitation(user.firstName, url)
        : authMails.passwordReset(user.firstName, url)),
    });
  }

  async resetPassword(
    dto: ResetPasswordDto,
  ): Promise<PasswordResetResponseDto> {
    const passwordHash = await this.passwords.hash(dto.password);
    const user = await this.prisma.$transaction(async (tx) => {
      const userId = await this.tokens.consume(
        dto.token,
        UserTokenPurpose.PASSWORD_RESET,
        tx,
      );
      const current = await tx.user.findUniqueOrThrow({
        where: { id: userId },
      });
      if (current.status !== UserStatus.ACTIVE) {
        // Revierte la transacción: el token no se gasta y la contraseña no cambia.
        throw new ForbiddenException(
          'Su cuenta está bloqueada o inactiva. Comuníquese con la farmacia.',
        );
      }
      // Quien recibió el enlace por correo demostró ser dueño de la dirección.
      return tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
          emailVerifiedAt: current.emailVerifiedAt ?? new Date(),
        },
      });
    });
    await this.sessions.revokeAllForUser(user.id);
    return {
      message: 'Su contraseña fue actualizada. Ya puede iniciar sesión.',
      type: user.type,
    };
  }

  async changePassword(
    principal: AuthUser,
    dto: ChangePasswordDto,
  ): Promise<MessageResponseDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: principal.id },
    });
    if (
      !(await this.passwords.verify(user.passwordHash, dto.currentPassword))
    ) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'La nueva contraseña debe ser distinta de la actual',
      );
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await this.passwords.hash(dto.newPassword) },
    });
    await this.sessions.revokeAllForUser(user.id, principal.sessionId);
    await this.mail.sendSafely({
      to: user.email,
      ...authMails.passwordChanged(user.firstName),
    });
    return { message: 'Su contraseña fue actualizada.' };
  }

  // ─── Internos ──────────────────────────────────────────────────────────────

  /** Suma un intento fallido; devuelve true si la cuenta quedó bloqueada. */
  private async registerFailedLogin(userId: string): Promise<boolean> {
    const max = this.config.get('AUTH_MAX_FAILED_LOGINS', { infer: true });
    const lockMinutes = this.config.get('AUTH_LOCK_MINUTES', { infer: true });
    const { failedLoginAttempts } = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
    if (failedLoginAttempts >= max) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: new Date(Date.now() + lockMinutes * 60_000),
        },
      });
      return true;
    }
    return false;
  }

  private async sendVerificationEmail(
    user: Pick<User, 'email' | 'firstName'>,
    token: string,
  ): Promise<void> {
    await this.mail.sendSafely({
      to: user.email,
      ...authMails.emailVerification(
        user.firstName,
        `${this.frontendUrl}/verificar-correo?token=${token}`,
      ),
    });
  }
}
