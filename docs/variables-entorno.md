# Variables de entorno

Las variables se validan al arrancar; si alguna es inválida la aplicación no inicia y el error indica cuál.

## Backend (`backend/.env`)

Validadas en `backend/src/config/env.validation.ts`. Plantilla: `backend/.env.example`.

### Generales

| Variable | Obligatoria | Por defecto | Descripción |
|---|---|---|---|
| `NODE_ENV` | No | `development` | `development`, `test` o `production` |
| `PORT` | No | `3000` | Puerto HTTP |
| `DATABASE_URL` | Sí | — | Cadena de conexión PostgreSQL |
| `SHADOW_DATABASE_URL` | Solo para `prisma migrate dev` | — | Base sombra para generar migraciones. No se usa en producción |
| `CORS_ORIGINS` | Sí | — | Orígenes permitidos, separados por coma (p. ej. `https://farmacia.gt`) |
| `FRONTEND_URL` | Sí | — | URL pública del frontend, para los enlaces de los correos |
| `TRUST_PROXY` | No | `loopback` | Valor de `trust proxy` de Express: desde qué direcciones se acepta `X-Forwarded-For` (la IP real del cliente que reenvía el BFF). Acepta `true`, `false`, un número de saltos o subredes (`loopback`, `10.0.0.0/8`) |
| `SWAGGER_ENABLED` | No | `true` fuera de producción, `false` en producción | Expone `/api/docs` |
| `THROTTLE_TTL_MS` | No | `60000` | Ventana del rate limiting global |
| `THROTTLE_LIMIT` | No | `120` | Peticiones por IP dentro de la ventana |
| `AUTH_THROTTLE_LIMIT` | No | `10` | Peticiones por IP y minuto en login, registro, recuperación y reenvío de verificación |

### Autenticación

| Variable | Obligatoria | Por defecto | Descripción |
|---|---|---|---|
| `JWT_ACCESS_SECRET` | Sí | — | Secreto HS256 de los access tokens (mín. 32 caracteres). Cambiarlo invalida todos los access tokens vigentes |
| `JWT_ACCESS_TTL_SECONDS` | No | `900` | Vigencia del access token (60–3600) |
| `REFRESH_TTL_CUSTOMER_DAYS` | No | `30` | Vigencia de la sesión de clientes; se extiende con cada uso |
| `REFRESH_TTL_STAFF_HOURS` | No | `12` | Vigencia de la sesión del personal; se extiende con cada uso |
| `AUTH_MAX_FAILED_LOGINS` | No | `5` | Intentos fallidos antes del bloqueo temporal |
| `AUTH_LOCK_MINUTES` | No | `15` | Duración del bloqueo temporal |
| `TOTP_ENCRYPTION_KEY` | Sí | — | Clave AES-256 (64 caracteres hexadecimales, `openssl rand -hex 32`) que cifra los secretos del doble factor. **Si se pierde o cambia, todos los usuarios deben configurar el doble factor de nuevo** |
| `MFA_ISSUER` | No | `Farmacia en línea` | Nombre que muestran las apps autenticadoras |

### Archivos

| Variable | Obligatoria | Por defecto | Descripción |
|---|---|---|---|
| `UPLOAD_DIR` | No | `./storage/uploads` | Directorio de los archivos cargados. En producción debe ser un volumen persistente con respaldo, fuera del código |
| `MAX_IMAGE_UPLOAD_MB` | No | `5` | Tamaño máximo de una imagen (1–20) |
| `MAX_PROOF_UPLOAD_MB` | No | `5` | Tamaño máximo de un comprobante de pago, imagen o PDF (1–20) |
| `RESERVATION_SWEEP_INTERVAL_SECONDS` | No | `300` | Cada cuánto se vencen las reservas de pedidos no pagados (0 lo desactiva; las pruebas usan 0) |
| `NOTIFICATION_DISPATCH_INTERVAL_SECONDS` | No | `30` | Cada cuánto se envían los correos pendientes de la bandeja de salida (0 lo desactiva; las pruebas usan 0) |
| `INVENTORY_DIGEST_HOUR` | No | `7` | Hora de Guatemala desde la que se envía el resumen diario de alertas de inventario al buzón del personal |

### Correo

| Variable | Obligatoria | Por defecto | Descripción |
|---|---|---|---|
| `MAIL_TRANSPORT` | No | `log` fuera de producción, `smtp` en producción | `log` escribe el correo en la consola (solo desarrollo y pruebas); en producción se exige `smtp` |
| `MAIL_FROM` | Sí | — | Remitente, p. ej. `Farmacia <no-responder@farmacia.gt>` |
| `SMTP_HOST` | Si `smtp` | — | Servidor SMTP |
| `SMTP_PORT` | No | `587` | |
| `SMTP_SECURE` | No | `false` | `true` = TLS implícito (465); `false` = STARTTLS |
| `SMTP_USER`, `SMTP_PASSWORD` | No | — | Credenciales SMTP |

### Seed (`pnpm db:seed`)

| Variable | Descripción |
|---|---|
| `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` | Obligatorias solo si aún no existe un superadministrador. Contraseña de al menos 12 caracteres |
| `INITIAL_ADMIN_FIRST_NAME`, `INITIAL_ADMIN_LAST_NAME` | Opcionales |

`backend/.env.test` usa las mismas variables apuntando a `farmacia_test` (con `AUTH_THROTTLE_LIMIT` y `THROTTLE_LIMIT` altos). Las pruebas e2e lo cargan automáticamente; una variable ya definida en el entorno (p. ej. en CI) tiene prioridad.

El CLI de Prisma y el seed cargan `.env`, o el archivo indicado en `ENV_FILE` (p. ej. `ENV_FILE=.env.test pnpm db:migrate:deploy`), salvo que `DATABASE_URL` ya esté definida en el entorno.

## Frontend (`frontend/.env`)

Declaradas en `frontend/src/env.ts` (`defineEnvVars` de SvelteKit 3).

| Variable | Obligatoria | Descripción |
|---|---|---|
| `API_URL` | Sí | URL base del backend sin `/api/v1` (p. ej. `http://localhost:3000`). Privada: solo la usa el servidor de SvelteKit (`$app/env/private`) |

### Servidor de producción (`node build`, adapter-node 6)

| Variable | Descripción |
|---|---|
| `PORT`, `HOST` | Puerto (3000) y dirección de escucha |
| `PROTOCOL_HEADER` | Cabecera con el protocolo original, p. ej. `x-forwarded-proto`. **Sin ella adapter-node supone `https`**; para probar `node build` por http local se debe definir y enviar `X-Forwarded-Proto: http`, o los formularios fallan con 403 (protección CSRF) |
| `HOST_HEADER` | Cabecera con el host original, p. ej. `x-forwarded-host` |
| `ADDRESS_HEADER`, `XFF_DEPTH` | Cabecera de la IP del cliente detrás del proxy (p. ej. `x-forwarded-for` y `1`). Necesaria para que la API reciba la IP real |
| `BODY_SIZE_LIMIT` | Tamaño máximo de una petición. **En producción `8M`**: el valor por defecto de adapter-node (512K) rechaza con 413 los comprobantes y las imágenes de más de 512 KB. La imagen Docker ya lo define |

## Producción (`.env.production`)

Lo lee `docker-compose.prod.yml`, que arma con estos valores el entorno de cada servicio. Plantilla: `.env.production.example`; ver [despliegue](despliegue.md).

| Variable | Descripción |
|---|---|
| `DOMAIN`, `ACME_EMAIL` | Dominio público y correo para el certificado de Let's Encrypt |
| `POSTGRES_PASSWORD` | Contraseña de la base (`openssl rand -hex 24`) |
| `JWT_ACCESS_SECRET`, `TOTP_ENCRYPTION_KEY`, `MFA_ISSUER` | Igual que en el backend |
| `MAIL_FROM`, `SMTP_*` | Correo de producción (obligatorio) |
| `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` | Primer superadministrador; vaciar la contraseña después del primer despliegue |
| `BACKUP_PATH` | Carpeta del servidor donde se guardan los respaldos (`./backups`) |
| `BACKUP_HOUR` | Hora de Guatemala del respaldo diario (`2`) |
| `BACKUP_KEEP_DAILY`, `BACKUP_KEEP_MONTHLY` | Copias conservadas (`14` y `12`, D20) |
