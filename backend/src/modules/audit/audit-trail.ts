import { requestContext } from '../../common/context/request-context.js';
import { Decimal } from '../../common/utils/money.js';
import type { Prisma } from '../../generated/prisma/client.js';

type Client = Pick<Prisma.TransactionClient, 'auditLog'>;

/** Campos que nunca se guardan en la auditoría. */
const SECRET_KEY = /pass(word)?|secret|token|totp|otp|recovery/i;
const MAX_STRING = 1000;
const MAX_DEPTH = 6;
export const REDACTED = '[oculto]';
/** Metadatos que cambian en cada edición y no aportan a la comparación. */
const IGNORED_KEYS = new Set(['updatedAt', 'updatedById']);

/** Copia los datos enviados sin secretos y con textos acotados. */
export function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return '[…]';
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  if (typeof value === 'object') {
    // Decimal de Prisma: se guarda como texto para no perder precisión.
    if (Decimal.isDecimal(value)) return value.toString();
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      out[key] = SECRET_KEY.test(key) ? REDACTED : sanitize(v, depth + 1);
    }
    return out;
  }
  return null;
}

/**
 * Deja solo los campos que cambiaron entre `before` y `after`. Se comparan
 * por su representación JSON, así Decimal y Date se comparan por valor.
 */
export function diff(
  before: object,
  after: object,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const result = {
    before: {} as Record<string, unknown>,
    after: {} as Record<string, unknown>,
  };
  const a0 = before as Record<string, unknown>;
  const b0 = after as Record<string, unknown>;
  for (const key of new Set([...Object.keys(a0), ...Object.keys(b0)])) {
    if (IGNORED_KEYS.has(key)) continue;
    const a = sanitize(a0[key]);
    const b = sanitize(b0[key]);
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      result.before[key] = a;
      result.after[key] = b;
    }
  }
  return result;
}

/**
 * Adjunta a la auditoría de la petición actual los valores que cambiaron.
 * Lo usan las operaciones donde importa el valor anterior (precios,
 * configuración, permisos). Fuera de una petición no hace nada.
 */
export function recordChanges(before: object, after: object): void {
  const context = requestContext();
  if (!context) return;
  const changes = diff(before, after);
  context.auditChanges = context.auditChanges
    ? {
        before: { ...context.auditChanges.before, ...changes.before },
        after: { ...context.auditChanges.after, ...changes.after },
      }
    : changes;
}

export interface AuditEntry {
  userId: string | null;
  action: string;
  module: string;
  route?: string | null;
  entityId?: string | null;
  changes?: unknown;
  statusCode?: number | null;
}

/** Inserta un registro con la IP y el navegador de la petición actual. */
export async function writeAudit(
  client: Client,
  entry: AuditEntry,
): Promise<void> {
  const context = requestContext();
  await client.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action.slice(0, 60),
      module: entry.module.slice(0, 40),
      route: entry.route?.slice(0, 200) ?? null,
      entityId: entry.entityId?.slice(0, 64) ?? null,
      changes:
        entry.changes === undefined
          ? undefined
          : (sanitize(entry.changes) as Prisma.InputJsonValue),
      statusCode: entry.statusCode ?? null,
      ip: context?.ip?.slice(0, 64) ?? null,
      userAgent: context?.userAgent ?? null,
    },
  });
}
