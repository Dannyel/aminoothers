import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthUser } from '../../common/auth/auth-user.js';
import {
  AuthRateLimit,
  CurrentUser,
  CustomerOnly,
  Public,
} from '../../common/decorators/auth.decorators.js';
import { UserType } from '../../generated/prisma/enums.js';
import { SkipAudit } from '../audit/audit.decorators.js';
import { AuthService } from './auth.service.js';
import {
  ChangePasswordDto,
  EmailDto,
  LoginDto,
  RefreshTokenDto,
  RegisterCustomerDto,
  ResetPasswordDto,
  TokenDto,
} from './dto/auth-requests.dto.js';
import {
  AuthTokensDto,
  MeResponseDto,
  MessageResponseDto,
  PasswordResetResponseDto,
} from './dto/auth-responses.dto.js';
import {
  AuthTokensWithRecoveryDto,
  MfaChallengeDto,
  MfaConfirmDto,
  MfaEnrollmentDto,
  MfaStatusDto,
  MfaTokenDto,
  MfaVerifyDto,
  RecoveryCodesDto,
  TotpCodeDto,
} from './dto/mfa.dto.js';
import { MfaService } from './mfa.service.js';
import type { ClientMeta } from './session.service.js';

@ApiTags('Autenticación')
// Los eventos de sesión se auditan en los servicios (LOGIN, LOGIN_FAILED).
@SkipAudit()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly mfa: MfaService,
  ) {}

  /** Registro de clientes desde la tienda. */
  @Public()
  @AuthRateLimit()
  @Post('register')
  register(@Body() dto: RegisterCustomerDto): Promise<MessageResponseDto> {
    return this.auth.registerCustomer(dto);
  }

  /** Inicio de sesión de clientes (tienda). */
  @Public()
  @AuthRateLimit()
  @HttpCode(HttpStatus.OK)
  @Post('store/login')
  storeLogin(@Body() dto: LoginDto): Promise<MfaChallengeDto> {
    return this.auth.login(UserType.CUSTOMER, dto);
  }

  /** Inicio de sesión del personal (panel administrativo). */
  @Public()
  @AuthRateLimit()
  @HttpCode(HttpStatus.OK)
  @Post('admin/login')
  adminLogin(@Body() dto: LoginDto): Promise<MfaChallengeDto> {
    return this.auth.login(UserType.STAFF, dto);
  }

  /** Primer inicio de sesión: secreto y contenido del QR para la app autenticadora. */
  @Public()
  @AuthRateLimit()
  @HttpCode(HttpStatus.OK)
  @Post('mfa/enroll')
  startMfaEnrollment(@Body() dto: MfaTokenDto): Promise<MfaEnrollmentDto> {
    return this.mfa.startEnrollment(dto.mfaToken);
  }

  /** Confirma la app con un código, inicia la sesión y entrega los códigos de recuperación. */
  @Public()
  @AuthRateLimit()
  @HttpCode(HttpStatus.OK)
  @Post('mfa/enroll/confirm')
  confirmMfaEnrollment(
    @Body() dto: MfaConfirmDto,
    @Req() req: Request,
  ): Promise<AuthTokensWithRecoveryDto> {
    return this.mfa.confirmEnrollment(dto.mfaToken, dto.code, clientMeta(req));
  }

  /** Segundo paso del inicio de sesión. */
  @Public()
  @AuthRateLimit()
  @HttpCode(HttpStatus.OK)
  @Post('mfa/verify')
  verifyMfa(
    @Body() dto: MfaVerifyDto,
    @Req() req: Request,
  ): Promise<AuthTokensDto> {
    return this.mfa.verify(dto.mfaToken, dto, clientMeta(req));
  }

  @Get('mfa')
  mfaStatus(@CurrentUser() user: AuthUser): Promise<MfaStatusDto> {
    return this.mfa.status(user.id);
  }

  /** Reemplaza los códigos de recuperación (exige un código de la app). */
  @AuthRateLimit()
  @HttpCode(HttpStatus.OK)
  @Post('mfa/recovery-codes')
  regenerateRecoveryCodes(
    @CurrentUser() user: AuthUser,
    @Body() dto: TotpCodeDto,
  ): Promise<RecoveryCodesDto> {
    return this.mfa.regenerateRecoveryCodes(user, dto.code);
  }

  /** Renueva la sesión. El refresh token usado deja de ser válido. */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<AuthTokensDto> {
    return this.auth.refresh(dto.refreshToken, clientMeta(req));
  }

  /** Cierra la sesión actual. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logout(@CurrentUser() user: AuthUser): Promise<void> {
    return this.auth.logout(user);
  }

  /** Cierra todas las sesiones del usuario en todos los dispositivos. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout-all')
  logoutAll(@CurrentUser() user: AuthUser): Promise<void> {
    return this.auth.logoutAll(user);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<MeResponseDto> {
    return this.auth.me(user.id);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  verifyEmail(@Body() dto: TokenDto): Promise<MessageResponseDto> {
    return this.auth.verifyEmail(dto.token);
  }

  @CustomerOnly()
  @AuthRateLimit()
  @HttpCode(HttpStatus.OK)
  @Post('resend-verification')
  resendVerification(
    @CurrentUser() user: AuthUser,
  ): Promise<MessageResponseDto> {
    return this.auth.resendVerification(user);
  }

  @Public()
  @AuthRateLimit()
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('forgot-password')
  forgotPassword(@Body() dto: EmailDto): Promise<MessageResponseDto> {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @AuthRateLimit()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<PasswordResetResponseDto> {
    return this.auth.resetPassword(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<MessageResponseDto> {
    return this.auth.changePassword(user, dto);
  }
}

function clientMeta(req: Request): ClientMeta {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}
