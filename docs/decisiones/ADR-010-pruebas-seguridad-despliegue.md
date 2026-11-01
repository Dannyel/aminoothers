# ADR-010 · Pruebas integrales, seguridad y preparación del despliegue

- Fecha: 2026-11-01
- Estado: aprobada (Fase 10)

## D20 · Retención de datos (decisión del usuario)

| Datos | Plazo |
|---|---|
| Auditoría | 5 años; un trigger impide borrar antes, incluso a mano |
| Correos enviados | 180 días desde el envío; los pendientes y fallidos se conservan |
| Respaldos | 14 diarios y 12 mensuales |

Además, por higiene, las sesiones vencidas o revocadas se borran a los 30 días, y los enlaces de un solo uso y los desafíos de doble factor, 7 días después de vencer o usarse. Lo aplica `RetentionService` (módulo `maintenance`) cada hora, con un candado de PostgreSQL. Los plazos están en `maintenance/retention.ts`; el de la auditoría vive también en el trigger (migración `20261101130000_audit_retention`), para que ningún proceso pueda acortarlo.

## Pruebas integrales

1. **`integral.e2e-spec.ts`: el ciclo completo solo a través de la API, con cada rol haciendo su parte.**
   - **Etapas:** catálogo; habilitación por el regente; compra al proveedor aprobada por Finanzas y recibida por Bodega en dos lotes; registro y verificación de una cliente nueva; compra contra entrega; confirmación, preparación y despacho FEFO; entrega con cobro y comprobante; devolución con inspección y reincorporación; reembolso.
   - **Comprobación final:** el kardex cuadra con las existencias, las ventas y los ingresos coinciden, el inventario valorizado es correcto, la auditoría registra el rol correcto en cada operación y la cliente recibe sus correos en orden.
2. **`security.e2e-spec.ts`: autorización de todas las rutas.**
   - **Metadata:** lee la de cada ruta registrada en Nest. Toda ruta `/admin` debe exigir personal y un permiso; la única excepción explícita es el dashboard, que filtra por permiso en el servicio. Toda ruta `/store` debe ser pública o exclusiva de clientes.
   - **Peticiones reales:** a cada ruta del panel, anónima, como cliente y como personal sin permisos.
   - **Además:** acceso a pedidos ajenos, asignación masiva, inyección SQL, archivos falsificados y cabeceras.
   - **Alcance:** un endpoint nuevo queda cubierto sin escribir una prueba nueva.
3. **`retention.e2e-spec.ts`:** los plazos de la D20 y la protección del trigger.
4. **Sin pruebas de navegador automatizadas.** Agregar Playwright sería una dependencia nueva. La interfaz se verificó con pruebas de humo por el BFF en cada fase y en el entorno Docker de esta fase. Queda como recomendación si el equipo mantiene el proyecto.

## Seguridad

La revisión y sus hallazgos están en [seguridad.md](../seguridad.md):

- nodemailer actualizado;
- `BODY_SIZE_LIMIT`;
- CSP en el frontend;
- `Permissions-Policy`.

## Despliegue

1. **Imágenes multietapa con `node:24.18.0-bookworm-slim`.**
   - **Etapas:** build, dependencias de producción sin scripts y runtime con el usuario `node`.
   - **Por qué Debian y no Alpine:** los binarios precompilados de argon2 y los motores de Prisma se usan sin compilar.
   - **Migraciones:** el servicio `migrate` usa la etapa de build, que trae el CLI de Prisma. La imagen de ejecución no lo incluye.
2. **Caddy como proxy.** Obtiene y renueva el certificado solo, con HSTS y redirección de www. Se prefirió a Nginx, la otra opción de la Fase 1, porque no requiere certbot ni configuración de TLS.
3. **Redes.**
   - `internal`, sin salida a Internet: base, migraciones, API y respaldos;
   - `egress`: salida de la API al servidor SMTP;
   - `public`: Caddy y frontend.

   Solo Caddy publica puertos. El navegador nunca habla con la API.
4. **Orden de arranque garantizado por el compose.** La API no arranca si las migraciones fallan, y el frontend espera a que la API esté sana.
5. **Respaldos.** `pg_dump` en formato personalizado más el archivo de cargas, con sumas SHA-256, rotación y restauración en una sola transacción. La copia fuera del servidor queda como responsabilidad operativa ([operación](../operacion.md)).
6. **Configuración.** La IP real del cliente viaja de Caddy al BFF (`ADDRESS_HEADER`, `XFF_DEPTH=1`) y del BFF a la API (`TRUST_PROXY=uniquelocal`), así el límite de peticiones y la auditoría usan la IP del usuario.

## Verificación del entorno de producción (Docker, local)

Se construyeron las tres imágenes y se levantó `docker-compose.prod.yml` completo con `DOMAIN=localhost` y un servidor SMTP de prueba (Mailpit):

1. **Arranque en orden:** las migraciones y el seed terminaron bien; API, frontend y Caddy quedaron saludables.
2. **HTTPS:** Caddy emitió el certificado; HTTP redirige a HTTPS (308); hay HSTS, CSP con nonce, `X-Frame-Options` y `Permissions-Policy`. La API no es accesible desde fuera (404).
3. **CSP:** en las páginas revisadas, todo script en línea lleva el nonce, los módulos son del mismo origen y no hay manejadores en línea. No se pudo abrir un navegador real porque no hay Chrome instalado.
4. **Sesión del superadministrador:** primer ingreso con configuración del doble factor por el BFF; cookies `httpOnly` y `Secure`.
5. **Carga grande:** un PNG de 1.5 MB llegó por Caddy y el BFF hasta la API (antes de la corrección fallaba con 413).
6. **Correo por SMTP:** la recuperación de contraseña llegó a Mailpit.
7. **IP real del cliente:** la auditoría registra la IP que ve Caddy, no la del contenedor del frontend.
8. **Respaldo y restauración:**
   - el respaldo manual se generó con sus sumas SHA-256;
   - tras simular la pérdida de datos (nombre comercial alterado y archivos borrados), la restauración recuperó ambos;
   - los 5 triggers de inmutabilidad siguieron activos.

Ajustes que salieron de esta verificación:

- **Compilación del frontend:** `src/env.ts` valida `API_URL` también al compilar, así que el Dockerfile le da un valor provisional; el real se toma al ejecutar.
- **Healthcheck del frontend:** debe enviar `X-Forwarded-For`, porque con `ADDRESS_HEADER` el frontend la exige.
- **openssl:** se instala en la etapa de compilación del backend; Prisma lo detecta al generar el cliente.

**Mejora pendiente:** la imagen del backend pesa unos 875 MB. Alrededor de 200 MB son el CLI de Prisma y sus herramientas (Studio, PGlite, TypeScript), que pnpm instala como dependencia par de `@prisma/client` (`autoInstallPeers` en el lockfile) aunque no se usan en ejecución. Quitarlas exige cambiar esa configuración y regenerar el lockfile; no afecta el funcionamiento.

## Pendiente fuera del alcance del desarrollo

- **Infraestructura (TI):** servidor, dominio, cuenta SMTP con SPF, DKIM y DMARC, y destino de la copia de respaldos fuera del servidor.
- **Regulatorio:** validación del catálogo y de los textos regulatorios con el regente (riesgo de la Fase 1).
- **Facturación electrónica:** elegir un certificador FEL para integrarlo (ADR-008).
- **Seguridad externa:** pentest antes de abrir al público.
