# ADR-002 · Autenticación, sesiones y permisos

- Fecha: 2026-10-31
- Estado: aprobada (Fase 3)

## Decisiones

### Tokens y sesiones

1. **Access token** JWT HS256 de 15 min con `sub`, `typ` y `sid` (familia de sesión).
2. **Refresh token** opaco de 256 bits; en la BD solo se guarda su SHA-256 (`sessions.token_hash`). Cada uso lo **rota**: se crea uno nuevo de la misma familia y el anterior queda revocado. La vigencia se extiende con cada rotación (30 días clientes, 12 h personal).
3. **Reutilización**: presentar un token ya rotado revoca toda la familia (posible robo), **salvo dentro de un margen de 30 s**. El margen cubre peticiones paralelas del BFF que renuevan con el mismo token antes de recibir el nuevo; sin él, abrir dos pestañas a la vez cerraría la sesión.
4. **El guard carga el usuario desde la BD en cada petición** (estado `ACTIVE`, sesión vigente y permisos). Bloquear, cerrar sesión o cambiar permisos tiene efecto inmediato sin listas negras de tokens. El costo es una consulta indexada por petición, aceptable para el volumen previsto.
5. Al cambiar roles o permisos **no** se revocan sesiones (ya no hace falta por el punto 4). Sí se revocan al bloquear o desactivar, al restablecer la contraseña (todas) y al cambiarla (todas menos la actual).

### Cuentas

6. Clientes y personal comparten `users` con `type` excluyente; cada portal tiene su propio login (`/auth/store/login`, `/auth/admin/login`). Una cuenta del otro portal recibe "credenciales incorrectas".
7. **Baja lógica con `status = INACTIVE`**: se omite la columna `users.deleted_at` del modelo de la Fase 1 porque duplicaba el estado.
8. **Contraseñas**: argon2id; política de 10 a 128 caracteres con letra y número. Bloqueo temporal de 15 min tras 5 intentos fallidos. Comparación de tiempo constante cuando el correo no existe.
9. **Registro sin enumeración**: la respuesta es la misma exista o no el correo; al dueño de una cuenta existente se le avisa por correo. La recuperación de contraseña también responde siempre igual.
10. **Altas de personal por invitación**: el administrador nunca define ni ve contraseñas; el usuario recibe un enlace (72 h) para definirla.
11. **Verificación de correo** obligatoria para comprar (D13); se valida en el checkout (Fase 6). El enlace del correo abre una página con botón (POST), porque algunos clientes de correo abren los enlaces automáticamente.
12. Siempre debe quedar un superadministrador activo (bloqueo de transacción `pg_advisory_xact_lock`); nadie cambia su propio estado ni sus roles.

### Permisos

13. Catálogo en código (`permissions.catalog.ts`) sincronizado por el seed. `SUPER_ADMIN` tiene todos los permisos de forma implícita y no se edita. `GET /admin/users/assignable-roles` (con `users.manage`) evita exigir `roles.read` para asignar roles.

### BFF y frontend

14. SvelteKit guarda los tokens en cookies `httpOnly`, `SameSite=Lax` (`fx_access`, `fx_refresh`) y renueva en `hooks.server.ts`. Reenvía a la API la IP (`X-Forwarded-For`) y el navegador del cliente; la API solo confía en esa cabecera desde `TRUST_PROXY`, para que el rate limiting sea por cliente y no por servidor.
15. CSRF: protección de origen de las form actions de SvelteKit. Las redirecciones tras el login solo aceptan rutas internas.
16. Los enlaces usan `resolve()` de `$app/paths`, que exige la regla de ESLint del proyecto. En SvelteKit 3 recibe rutas sin barra inicial (`resolve('admin/usuarios')`).

### Correo

17. `MailService` con transporte `smtp` (nodemailer) o `log` (solo fuera de producción). El envío es directo y sus fallas no revierten la operación; la bandeja de salida con reintentos llega en la Fase 9.

## Pendiente para fases posteriores

- **Auditoría** de cambios de usuarios, roles y permisos: la tabla y el servicio se implementan en la Fase 9 (según el plan de fases) y se conectarán a estos servicios.
- Limpieza periódica de sesiones y tokens vencidos (job de la Fase 9).
- El perfil del cliente no permite **vaciar** teléfono, nombre de facturación ni fecha de nacimiento una vez cargados (solo cambiarlos). Se resolverá al rediseñar la cuenta en la Fase 6.
