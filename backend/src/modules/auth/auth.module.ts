import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { MfaService } from './mfa.service.js';
import { PasswordService } from './password.service.js';
import { SessionTokensService } from './session-tokens.service.js';
import { PrincipalService } from './principal.service.js';
import { SessionService } from './session.service.js';
import { UserTokenService } from './user-token.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    SessionService,
    UserTokenService,
    PrincipalService,
    SessionTokensService,
    MfaService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService, PasswordService, SessionService, MfaService],
})
export class AuthModule {}
