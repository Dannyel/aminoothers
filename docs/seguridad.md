# Seguridad

Controles del sistema y cómo se verifican. La revisión de la Fase 10 se hizo sobre el código completo con las categorías del OWASP Top 10 (2021). Cada control indica la prueba automática que lo comprueba, cuando la hay.

## Controles

| Riesgo | Control | Verificación |
|---|---|---|
| **A01 Control de acceso** | Guard global: toda ruta exige sesión salvo `@Public`. El panel exige personal y un permiso por endpoint; la tienda exige cliente. Cada pedido, dirección y comprobante se busca filtrando por el cliente dueño, así que el de otro cliente responde 404 | `security.e2e-spec.ts` recorre **todas** las rutas registradas: la metadata, y peticiones reales anónimas, de cliente y de personal sin permisos a cada ruta del panel (401 y 403). También prueba el acceso a pedidos ajenos |
| **A02 Criptografía** | Contraseñas con Argon2id; tokens de un solo uso guardados como hash SHA-256; secretos TOTP cifrados con AES-256-GCM; HTTPS obligatorio con HSTS (Caddy); cookies `httpOnly`, `SameSite=Lax` y `Secure` en producción; tokens solo en el BFF, nunca en el navegador | `auth`, `mfa` y `session.spec` |
| **A03 Inyección** | Prisma con parámetros; las consultas SQL propias usan plantillas etiquetadas (`$queryRaw\`…\``), y los fragmentos `Prisma.raw` son constantes sin datos del usuario. Las plantillas de correo escapan el HTML. CSV sin fórmulas | Búsqueda con `'; DROP TABLE` en `security.e2e-spec`; `notification-templates.spec`; `reports.spec` |
| **A04 Diseño inseguro** | Precios, descuentos, impuestos, existencias y totales los calcula siempre el backend; el total esperado del cliente solo detecta cambios (409). Bloqueos de fila y FEFO evitan la sobreventa. Idempotencia en el checkout | `checkout.e2e-spec` (checkouts simultáneos), `integral.e2e-spec`, asignación masiva en `security.e2e-spec` |
| **A05 Configuración** | Helmet en la API; CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` y `Permissions-Policy` en el frontend; Swagger apagado en producción; variables validadas al arrancar (longitud mínima de los secretos, SMTP en producción); `forbidNonWhitelisted` rechaza campos no declarados; la API y la base no se exponen a Internet | `security.e2e-spec` (cabeceras), `env.validation.spec` |
| **A06 Componentes vulnerables** | Versiones fijas; `pnpm audit --prod` sin vulnerabilidades. En la Fase 10 se actualizó nodemailer de 10.0.16 a 10.1.7 (GHSA-85x2-q946-cp5h) | `pnpm audit --prod` en backend y frontend |
| **A07 Autenticación** | Doble factor TOTP obligatorio para todos, sin reutilizar códigos; bloqueo tras 5 intentos fallidos; límite estricto de peticiones en autenticación; respuestas que no revelan si un correo existe; rotación de refresh tokens con detección de reutilización; bloquear un usuario revoca sus sesiones al instante | `auth`, `mfa` y `rate-limit` e2e |
| **A08 Integridad** | Los archivos se validan por su contenido (firma), no por la extensión; los comprobantes son privados y se sirven con `CSP sandbox`; movimientos de inventario, historiales y auditoría son de solo inserción por trigger | `security.e2e-spec` (texto con extensión `.png`), `inventory` y `retention` e2e |
| **A09 Registro y monitoreo** | Auditoría de toda operación del personal con IP y valores anteriores; inicios de sesión fallidos y bloqueos; acceso a comprobantes; retención de 5 años (D20) | `reports-notifications-audit.e2e-spec`, `retention.e2e-spec` |
| **A10 SSRF** | La API no descarga URL proporcionadas por usuarios. Las URL de rastreo de las mensajerías solo se usan como enlace en el navegador del cliente | Revisión de código |

## Hallazgos de la revisión de la Fase 10

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| 1 | nodemailer < 10.1.4 con tres advisories moderados (análisis de direcciones) | Media | Corregido: 10.1.7 |
| 2 | adapter-node limita las peticiones a 512 KB por defecto: en producción, los comprobantes y las imágenes de más de 512 KB fallaban con 413. No se notaba en desarrollo | Alta (funcional) | Corregido: `BODY_SIZE_LIMIT=8M` en la imagen del frontend, y `request_body` de 10 MB en Caddy |
| 3 | El frontend no enviaba Content-Security-Policy | Media | Corregido: CSP de SvelteKit con hashes de scripts, `frame-ancestors 'none'` y `form-action 'self'` |
| 4 | El proxy del comprobante no reenviaba la IP del usuario, así que la auditoría registraba la del servidor | Baja | Corregido en la Fase 9 |
| 5 | No había retención: la auditoría y los correos con datos personales crecían sin límite | Baja | Corregido: D20 |

## Riesgos aceptados

- **`style-src 'unsafe-inline'`.** Las directivas `style:` de Svelte generan estilos en línea. El riesgo es bajo porque los scripts siguen restringidos a `'self'` más los hashes.
- **Auditoría escrita después de la operación** (ADR-009 §13). Si esa escritura fallara justo después de confirmarse la operación, el error queda en el log del servidor.
- **CSRF.** Lo cubren la verificación de origen de SvelteKit en los formularios y las cookies `SameSite=Lax`; no hay tokens CSRF explícitos.

## Recomendaciones para producción

1. Pentest externo antes de abrir al público, en especial del checkout, los comprobantes y el panel.
2. Copia de respaldos fuera del servidor, cifrada (ver [operación](operacion.md#respaldos)).
3. Revisar mensualmente los inicios de sesión fallidos en la auditoría y ejecutar `pnpm audit` en cada actualización.
4. Rotar `JWT_ACCESS_SECRET` una vez al año y cada vez que alguien con acceso al servidor deje la organización.
