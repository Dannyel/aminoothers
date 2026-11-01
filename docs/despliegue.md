# Despliegue en producción

Un VPS con Docker Compose (D17): PostgreSQL, la API, el frontend (BFF), Caddy (HTTPS automático) y los respaldos, todo en el mismo servidor. Archivos: `docker-compose.prod.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `docker/caddy/Caddyfile`, `docker/backup/`.

```
Internet ──443──▶ Caddy ──▶ frontend (BFF, :3000) ──▶ backend (API, :3000) ──▶ PostgreSQL
                                                         │
                                                         └──▶ SMTP (salida)
```

Solo Caddy publica puertos (80 y 443). La API, la base de datos y los respaldos están en una red de Docker sin salida a Internet; la API tiene además una red de salida para el correo, sin puertos publicados. El navegador nunca habla con la API: todo pasa por el BFF.

## Requisitos

| Recurso | Mínimo recomendado |
|---|---|
| VPS | 2 vCPU, 4 GB de RAM, 40 GB SSD, Ubuntu 24.04 o Debian 12 |
| Software | Docker Engine 27+ con el plugin Compose v2 |
| Dominio | Registro A (y AAAA si hay IPv6) apuntando al VPS, para `dominio` y `www.dominio` |
| Firewall | Entrada solo 22 (SSH, de preferencia restringido por IP), 80 y 443 |
| Correo | Cuenta SMTP del dominio con SPF, DKIM y DMARC configurados |

## Primer despliegue

```bash
git clone <repositorio> farmacia && cd farmacia
cp .env.production.example .env.production
chmod 600 .env.production
# Completar: DOMAIN, ACME_EMAIL, POSTGRES_PASSWORD, JWT_ACCESS_SECRET,
# TOTP_ENCRYPTION_KEY, MAIL_FROM, SMTP_*, INITIAL_ADMIN_EMAIL/PASSWORD.
#   openssl rand -hex 24   → POSTGRES_PASSWORD
#   openssl rand -hex 32   → JWT_ACCESS_SECRET y TOTP_ENCRYPTION_KEY (distintos)

docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

Orden de arranque, controlado por las dependencias del compose:

1. `postgres` arranca y queda saludable.
2. `migrate` aplica las migraciones (`prisma migrate deploy`), sincroniza permisos y roles y crea el primer superadministrador si no hay ninguno; luego termina.
3. `backend` arranca cuando `migrate` terminó bien.
4. `frontend` arranca cuando la API está saludable.
5. `caddy` obtiene el certificado de Let's Encrypt y empieza a atender.

Después del primer despliegue:

1. Ingresar a `https://DOMINIO/admin/login` con el superadministrador y configurar la app autenticadora (doble factor obligatorio).
2. **Borrar `INITIAL_ADMIN_PASSWORD`** de `.env.production`.
3. En **Configuración**, completar los datos de la farmacia, el texto regulatorio, el correo de alertas del personal, los métodos de envío, las mensajerías y las cuentas bancarias.
4. Crear los usuarios del personal con sus roles; cada uno define su contraseña con el enlace de invitación.
5. Hacer una compra de prueba completa y luego cancelarla.

## Actualizar a una versión nueva

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

`migrate` se vuelve a ejecutar en cada `up`: aplica solo las migraciones nuevas y agrega a los roles los permisos nuevos del catálogo. Antes de una actualización con migraciones, generar un respaldo manual (ver [operación](operacion.md#respaldo-manual)). Las migraciones son aditivas; si una falla, `migrate` termina con error, la API anterior sigue corriendo y no se arranca la nueva.

## Variables

Todas se definen en `.env.production`. La tabla completa está en [variables de entorno](variables-entorno.md). La API valida al arrancar que existan los secretos con su longitud mínima y, en producción, que el correo sea SMTP. Swagger está apagado por defecto en producción; el compose lo fija en `false`.

La imagen del frontend ya trae `BODY_SIZE_LIMIT=8M`, los encabezados del proxy (`PROTOCOL_HEADER`, `ADDRESS_HEADER`, `XFF_DEPTH=1`) y `ORIGIN=https://DOMINIO`. Sin `BODY_SIZE_LIMIT`, adapter-node rechaza con 413 cualquier comprobante o imagen de más de 512 KB.

## Verificación después de desplegar

```bash
curl -fsS https://DOMINIO/health           # {"status":"ok","api":"up","database":"up"}
curl -sI https://DOMINIO | grep -iE 'strict-transport|content-security|x-frame'
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=50 backend
```

## Antes de abrir al público (checklist)

- [ ] Validación regulatoria del catálogo con el regente y un profesional competente (riesgo regulatorio de la Fase 1): solo productos OTC habilitados.
- [ ] Texto regulatorio, licencia sanitaria y nombre del regente configurados.
- [ ] SPF, DKIM y DMARC verificados (enviar una recuperación de contraseña a Gmail y a Outlook).
- [ ] Respaldo automático funcionando y **una restauración probada** en otro servidor.
- [ ] `INITIAL_ADMIN_PASSWORD` vacío y `.env.production` con permisos 600.
- [ ] SSH solo con llave y firewall con 22, 80 y 443.
- [ ] Monitoreo externo de `https://DOMINIO/health` (por ejemplo, un servicio de *uptime*).
- [ ] Cuentas bancarias revisadas: el cliente las ve al pagar por transferencia.
