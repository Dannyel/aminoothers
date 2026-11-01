import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

/** Valores antes/después que un servicio adjunta a la auditoría de la petición. */
export interface AuditChanges {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

/** Datos de la petición en curso disponibles en cualquier capa sin pasarlos a mano. */
export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
  auditChanges?: AuditChanges;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Middleware de Express: abre el contexto de cada petición. */
export function requestContextMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  storage.run(
    {
      ip: req.ip ?? null,
      userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
    },
    next,
  );
}

/** Contexto de la petición actual; indefinido en tareas en segundo plano. */
export function requestContext(): RequestContext | undefined {
  return storage.getStore();
}
