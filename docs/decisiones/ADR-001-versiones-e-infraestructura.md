# ADR-001 · Versiones e infraestructura base

- Fecha: 2026-10-31
- Estado: aprobada (Fase 2)

## Contexto

La Fase 2 crea los proyectos con los generadores oficiales y debe fijar versiones estables.

## Decisiones

1. **NestJS 12** (generado con `@nestjs/cli` 12): ESM (`"type": "module"`, imports con `.js`), Vitest en lugar de Jest, oxlint en lugar de ESLint y TypeScript 6. Se mantienen las herramientas que trae el generador para no agregar configuración propia. Se eliminó el `AGENTS.md` del generador, que promociona un servicio externo de telemetría no solicitado.
2. **Prisma 7.10.1**, no 8. La etiqueta `latest` de npm del paquete `prisma` apunta a `8.0.0-rc.29` (preliminar). Se usa la última estable, con el generador `prisma-client` (ESM), `@prisma/adapter-pg` y `prisma.config.ts`.
3. **SvelteKit 3 / Svelte 5 / Tailwind 4** (generado con `sv` 1.2). La configuración de SvelteKit vive en `vite.config.ts`; el alias de la librería es `#lib/...` con extensión explícita (`#lib/server/api.ts`); las variables de entorno se declaran en `src/env.ts` y se importan desde `$app/env/private`.
4. **BFF**: el navegador solo habla con SvelteKit; el cliente de la API (`frontend/src/lib/server/api.ts`) es de servidor.
5. **Tipos compartidos**: `openapi-typescript` genera `frontend/src/lib/api/schema.ts` desde Swagger, para que frontend y backend no diverjan.
6. **API**: prefijo `/api`, versionado por URI (`/api/v1`), `helmet`, CORS con lista explícita, `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`) y rate limiting global en memoria (`@nestjs/throttler`).
7. **Base sombra dedicada** (`SHADOW_DATABASE_URL`) para `prisma migrate dev`, porque el `template1` del PostgreSQL local tiene una versión de collation desactualizada y Prisma no puede crear la base sombra automáticamente. También evita dar permisos de creación de bases en otros entornos.
8. **Pruebas e2e contra PostgreSQL real** (`farmacia_test`), en serie, migradas antes de cada ejecución.

## Consecuencias

- Las versiones mayores de NestJS 12 y SvelteKit 3 son recientes (ago. y oct. de 2026); se revisarán sus notas de versión al actualizar.
- Al publicarse Prisma 8 estable se evaluará la actualización con un ADR propio.
