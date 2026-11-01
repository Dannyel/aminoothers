# ADR-003 · Doble factor de autenticación (TOTP)

- Fecha: 2026-10-31
- Estado: aprobado por el negocio (método y alcance); implementado en la Fase 3

## Decisión del negocio

- **Método:** app autenticadora TOTP (RFC 6238: Google Authenticator, Microsoft Authenticator, Authy…).
- **Alcance:** **obligatorio para todos** los usuarios, clientes y personal.

## Diseño

1. **Inicio de sesión en dos pasos.** `POST /auth/{store|admin}/login` ya no devuelve tokens. Si la contraseña es correcta devuelve un **desafío** (`mfaToken`, de un solo uso, 5 min, máximo 5 intentos; en la BD solo se guarda su hash, tabla `mfa_challenges`) y `enrollmentRequired`. La sesión se emite solo al completar:
   - `POST /auth/mfa/verify` con `code` (6 dígitos) o `recoveryCode`, o
   - `POST /auth/mfa/enroll` (secreto + `otpauthUri` para el QR) y `POST /auth/mfa/enroll/confirm` (primer código) la primera vez, que devuelve la sesión y **10 códigos de recuperación**.
2. **Secreto TOTP cifrado** con AES-256-GCM (`TOTP_ENCRYPTION_KEY`); un volcado de la BD no permite generar códigos.
3. **Un código, un uso:** se guarda el último paso de tiempo aceptado (`users.totp_last_step`) y se rechazan códigos de ese paso o anteriores. Tolerancia de ±30 s por desfase de reloj.
4. **Códigos de recuperación:** 10 de 50 bits (`ABCDE-FGHIJ`), de un solo uso, guardados como SHA-256 (`user_recovery_codes`). Se aceptan sin guion y en minúsculas. Se pueden regenerar desde "Seguridad" con un código vigente de la app (`POST /auth/mfa/recovery-codes`).
5. **Pérdida del teléfono y de los códigos:** un administrador (`users.manage` para el personal, `customers.manage` para clientes) restablece el doble factor (`POST /admin/{users|customers}/:id/mfa-reset`); se cierran las sesiones, se avisa por correo y el usuario lo configura de nuevo al ingresar. Nadie restablece el suyo propio. Este paso debe ir precedido de una verificación de identidad fuera del sistema; el procedimiento lo define la farmacia.
6. **Implementación propia de TOTP** (`common/utils/totp.ts`, ~100 líneas con `node:crypto`) validada contra los vectores del RFC 6238, para no agregar una dependencia al backend. El frontend usa `qrcode` (servidor) para dibujar el QR como SVG.
7. **BFF:** el desafío se guarda en la cookie httpOnly `fx_mfa` (vence con el desafío). Rutas: `/login/verificacion`, `/login/configurar-doble-factor` y sus equivalentes bajo `/admin/login/`.

## Riesgos aceptados

- La configuración inicial ocurre tras validar la contraseña: quien conozca la contraseña de una cuenta que **aún no** configuró el doble factor podría registrar su propia app. Se mitiga con la verificación de correo (clientes) y la invitación por correo (personal), y desaparece una vez que el titular lo configura.
- El doble factor obligatorio agrega un paso al primer inicio de sesión de cada cliente.
