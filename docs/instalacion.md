# Instalación (desarrollo)

## Requisitos

| Herramienta | Versión usada |
|---|---|
| Node.js | 24 LTS |
| pnpm | 11 |
| PostgreSQL | 18 (local o con Docker) |

pnpm 11 bloquea los scripts de instalación de dependencias que no estén aprobados. Los aprobados están en `backend/pnpm-workspace.yaml` (`allowBuilds`): `prisma` y `@prisma/engines` sí, `@scarf/scarf` (telemetría de swagger-ui) no.

## 1. Base de datos

Se necesitan tres bases, todas del rol `farmacia`:

| Base | Uso |
|---|---|
| `farmacia_dev` | Desarrollo |
| `farmacia_test` | Pruebas e2e (se migran automáticamente antes de ejecutarlas) |
| `farmacia_shadow` | Base sombra de `prisma migrate dev` |

### Opción A · PostgreSQL local

```bash
psql -d postgres <<'SQL'
CREATE ROLE farmacia LOGIN CREATEDB PASSWORD 'una-contraseña';
CREATE DATABASE farmacia_dev    OWNER farmacia TEMPLATE template0 ENCODING 'UTF8';
CREATE DATABASE farmacia_test   OWNER farmacia TEMPLATE template0 ENCODING 'UTF8';
CREATE DATABASE farmacia_shadow OWNER farmacia TEMPLATE template0 ENCODING 'UTF8';
SQL
```

Se usa `TEMPLATE template0` para no depender de `template1`, que en algunos sistemas queda con una versión de *collation* desactualizada después de actualizar glibc.

### Opción B · Docker

```bash
docker compose up -d postgres     # puerto 5433, crea las tres bases
```

Contraseña por defecto `farmacia_dev` (cambiar con la variable `POSTGRES_PASSWORD`). En `.env` usar `localhost:5433`.

## 2. Backend

```bash
cd backend
cp .env.example .env              # editar credenciales
cp .env.example .env.test         # cambiar a farmacia_test, NODE_ENV=test, PORT=3001
pnpm install                      # también ejecuta `prisma generate`
pnpm db:migrate:deploy
pnpm build
INITIAL_ADMIN_EMAIL=admin@farmacia.local INITIAL_ADMIN_PASSWORD='una-clave-larga' pnpm db:seed
pnpm start:dev
```

El seed crea los permisos, los roles de sistema y el primer superadministrador. En desarrollo (`MAIL_TRANSPORT=log`) los correos —verificación, recuperación, invitaciones— se escriben en la consola del backend; de ahí se copian los enlaces.

- Tienda: `http://localhost:5173/login` · Panel: `http://localhost:5173/admin/login`

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/api/docs`
- Salud: `GET http://localhost:3000/api/v1/health`

## 3. Frontend

```bash
cd frontend
cp .env.example .env
pnpm install
pnpm dev                          # http://localhost:5173
```

Comprobar la conexión con la API: `GET http://localhost:5173/health` → `{"status":"ok","api":"up","database":"up"}`.

Con el backend corriendo, `pnpm gen:api` regenera los tipos de la API (`src/lib/api/schema.ts`) desde Swagger.

## 4. Verificación

| Comando | Carpeta | Qué hace |
|---|---|---|
| `pnpm test` | backend | Pruebas unitarias |
| `pnpm test:e2e` | backend | Migra `farmacia_test` y ejecuta las pruebas e2e contra PostgreSQL real |
| `pnpm lint` | backend | oxlint con verificación de tipos |
| `pnpm build` | backend | Genera el cliente Prisma y compila |
| `pnpm check` | frontend | svelte-check (tipos) |
| `pnpm test` | frontend | Pruebas unitarias (Vitest) |
| `pnpm lint` | frontend | Prettier + ESLint |
| `pnpm build` | frontend | Build de producción (adapter-node) |
