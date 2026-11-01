import {
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { concatMap, type Observable } from 'rxjs';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { requestContext } from '../../common/context/request-context.js';
import { UserType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AUDIT_READ_KEY, SKIP_AUDIT_KEY } from './audit.decorators.js';
import { writeAudit } from './audit-trail.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

type AuditedRequest = Request & {
  user?: AuthUser;
  file?: { originalname: string; mimetype: string; size: number };
};

/**
 * Audita toda operación exitosa del personal que modifica datos (y las
 * consultas marcadas con @AuditRead): quién, qué endpoint, sobre qué
 * registro, con qué datos, desde qué IP. Los servicios pueden agregar los
 * valores anteriores con `recordChanges`. Se escribe después de que la
 * operación se confirmó; si la escritura falla se registra en el log y la
 * respuesta no se altera.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(SKIP_AUDIT_KEY, targets)) {
      return next.handle();
    }
    const request = context.switchToHttp().getRequest<AuditedRequest>();
    const audited =
      MUTATING.has(request.method) ||
      this.reflector.getAllAndOverride<boolean>(AUDIT_READ_KEY, targets);
    if (!audited) return next.handle();

    return next.handle().pipe(
      concatMap(async (result: unknown) => {
        const user = request.user;
        if (user?.type === UserType.STAFF) {
          await this.write(context, request, user, result);
        }
        return result;
      }),
    );
  }

  private async write(
    context: ExecutionContext,
    request: AuditedRequest,
    user: AuthUser,
    result: unknown,
  ): Promise<void> {
    const path = routePath(request);
    const params = { ...request.params };
    const resultId =
      result && typeof result === 'object' && 'id' in result
        ? (result as { id: unknown }).id
        : undefined;
    const extra = requestContext()?.auditChanges;
    try {
      await writeAudit(this.prisma, {
        userId: user.id,
        action: context.getHandler().name,
        module: moduleOf(path),
        route: `${request.method} ${path}`,
        entityId:
          (typeof params.id === 'string' ? params.id : null) ??
          (typeof resultId === 'string' || typeof resultId === 'number'
            ? String(resultId)
            : null),
        changes: {
          ...(Object.keys(params).length ? { params } : {}),
          ...(MUTATING.has(request.method) &&
          request.body &&
          Object.keys(request.body as object).length
            ? { request: request.body as unknown }
            : {}),
          ...(request.file
            ? {
                file: {
                  name: request.file.originalname,
                  type: request.file.mimetype,
                  size: request.file.size,
                },
              }
            : {}),
          ...(extra ? { before: extra.before, after: extra.after } : {}),
        },
        statusCode:
          this.reflector.get<number>(
            HTTP_CODE_METADATA,
            context.getHandler(),
          ) ?? (request.method === 'POST' ? 201 : 200),
      });
    } catch (error) {
      this.logger.error(
        `No se pudo auditar ${request.method} ${path} de ${user.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

/** Ruta del endpoint con sus parámetros (`/admin/products/:id`), sin el prefijo de la API. */
export function routePath(request: Request): string {
  const pattern = (request.route as { path?: string } | undefined)?.path;
  const full = pattern
    ? `${request.baseUrl}${pattern}`
    : request.originalUrl.split('?')[0];
  return full.replace(/^\/api(\/v\d+)?/, '') || '/';
}

/** Módulo a partir de la ruta: `/admin/products/:id` → `products`. */
export function moduleOf(path: string): string {
  const segments = path.split('/').filter(Boolean);
  const start = segments[0] === 'admin' ? 1 : 0;
  return segments[start] ?? 'admin';
}
