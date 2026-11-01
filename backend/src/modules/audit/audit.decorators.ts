import { SetMetadata } from '@nestjs/common';

export const SKIP_AUDIT_KEY = 'audit:skip';
export const AUDIT_READ_KEY = 'audit:read';

/** El controlador o endpoint no se audita automáticamente (p. ej. auth, que registra sus propios eventos). */
export const SkipAudit = () => SetMetadata(SKIP_AUDIT_KEY, true);

/** Audita también la consulta: acceso a datos sensibles como comprobantes de pago. */
export const AuditRead = () => SetMetadata(AUDIT_READ_KEY, true);
