import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { requestContextMiddleware } from './common/context/request-context.js';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter.js';
import type { EnvironmentVariables } from './config/env.validation.js';

export const API_PREFIX = 'api';
export const SWAGGER_PATH = `${API_PREFIX}/docs`;

/**
 * Configuración HTTP compartida por main.ts y las pruebas e2e, para que las
 * pruebas ejerciten exactamente la misma aplicación que se despliega.
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService<EnvironmentVariables, true>);

  // La IP real del cliente llega en X-Forwarded-For desde el BFF; se usa en el
  // rate limiting y en el registro de sesiones.
  app.set(
    'trust proxy',
    parseTrustProxy(config.get('TRUST_PROXY', { infer: true })),
  );

  // IP y navegador de cada petición para la auditoría (después de trust proxy).
  app.use(requestContextMiddleware);

  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.use(helmet());
  app.enableCors({
    origin: config
      .get('CORS_ORIGINS', { infer: true })
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter(app.getHttpAdapter()));

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Farmacia en línea · API')
        .setDescription('API REST de la tienda y del panel administrativo.')
        .setVersion('1')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup(SWAGGER_PATH, app, document, {
      jsonDocumentUrl: `${SWAGGER_PATH}-json`,
    });
  }

  app.enableShutdownHooks();
}

/** 'true' | 'false' | número de saltos | lista de subredes de Express. */
function parseTrustProxy(value: string): boolean | number | string {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return /^\d+$/.test(value) ? Number(value) : value;
}
