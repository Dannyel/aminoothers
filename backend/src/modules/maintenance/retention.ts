/**
 * Plazos de conservación (D20). La auditoría además está protegida por un
 * trigger que impide borrar registros más recientes que AUDIT_RETENTION_YEARS.
 */
export const RETENTION = {
  /** Correos enviados: se borran tras este plazo desde su envío. */
  SENT_NOTIFICATION_DAYS: 180,
  AUDIT_YEARS: 5,
  /** Sesiones vencidas o revocadas: se conservan un tiempo para investigar incidentes. */
  EXPIRED_SESSION_DAYS: 30,
  /** Enlaces de un solo uso y desafíos de doble factor vencidos o usados. */
  USED_TOKEN_DAYS: 7,
} as const;

const DAY_MS = 86_400_000;

/** Límites de antigüedad a partir de los cuales cada registro se puede borrar. */
export function retentionCutoffs(now: Date) {
  const audit = new Date(now);
  audit.setUTCFullYear(audit.getUTCFullYear() - RETENTION.AUDIT_YEARS);
  return {
    sentNotifications: new Date(
      now.getTime() - RETENTION.SENT_NOTIFICATION_DAYS * DAY_MS,
    ),
    audit,
    sessions: new Date(now.getTime() - RETENTION.EXPIRED_SESSION_DAYS * DAY_MS),
    tokens: new Date(now.getTime() - RETENTION.USED_TOKEN_DAYS * DAY_MS),
  };
}
