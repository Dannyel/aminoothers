# Farmacia en línea

Tienda en línea y panel administrativo de una farmacia en Guatemala.

| Parte | Tecnología | Carpeta |
|---|---|---|
| API | NestJS 12 · Prisma 7 · PostgreSQL 18 | [`backend/`](backend/) |
| Tienda y panel | SvelteKit 3 · Svelte 5 · Tailwind CSS 4 | [`frontend/`](frontend/) |

## Inicio rápido

```bash
# 1. Backend
cd backend
cp .env.example .env          # ajustar DATABASE_URL y SHADOW_DATABASE_URL
pnpm install
pnpm db:migrate:deploy
pnpm build && pnpm db:seed     # requiere INITIAL_ADMIN_EMAIL/PASSWORD la primera vez
pnpm start:dev                # http://localhost:3000/api/docs

# 2. Frontend (otra terminal)
cd frontend
cp .env.example .env
pnpm install
pnpm dev                      # http://localhost:5173
```

Guía completa en [docs/instalacion.md](docs/instalacion.md).

## Documentación

- [Fase 1 · Análisis y arquitectura](docs/fase-1/README.md) (aprobada)
- [Instalación](docs/instalacion.md)
- [Variables de entorno](docs/variables-entorno.md)
- [Migraciones](docs/migraciones.md)
- [Despliegue en producción](docs/despliegue.md)
- [Operación: respaldos, retención, monitoreo e incidentes](docs/operacion.md)
- [Seguridad: controles y revisión](docs/seguridad.md)
- [Manual del panel administrativo](docs/manual-panel.md)
- [Decisiones técnicas](docs/decisiones/)
- API: Swagger en `http://localhost:3000/api/docs` (JSON en `/api/docs-json`)

## Estado

| Fase | Estado |
|---|---|
| 1. Análisis y arquitectura | Aprobada |
| 2. Infraestructura | Aprobada |
| 3. Seguridad y usuarios (con doble factor TOTP) | Aprobada |
| 4. Catálogos | Aprobada |
| 5. Inventario y compras | Aprobada |
| 6. Tienda en línea | Aprobada |
| 7. Ventas y pagos | Aprobada |
| 8. Contabilidad y promociones | Aprobada |
| 9. Reportes y notificaciones | Aprobada |
| 10. Pruebas y producción | Aprobada |
