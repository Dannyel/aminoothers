# Backend · API de la farmacia

NestJS 12 + Prisma 7 + PostgreSQL. Monolito modular: un directorio por módulo en `src/modules/`.

```
src/
├── main.ts            # arranque
├── app.setup.ts       # prefijo /api, versionado v1, helmet, CORS, validación, Swagger (compartido con e2e)
├── app.module.ts
├── common/            # decoradores de acceso, filtros, validadores, paginación
├── config/            # validación de variables de entorno
├── database/seed.ts   # permisos, roles de sistema y superadministrador inicial
├── prisma/            # PrismaService (única conexión)
├── generated/prisma/  # cliente generado (no versionado)
└── modules/
    ├── auth/          # login en dos pasos con TOTP, refresh rotativo, recuperación, guard global
    ├── users/         # personal: alta por invitación, roles, bloqueo
    ├── roles/         # roles, catálogo de permisos
    ├── customers/     # perfil, direcciones, administración de clientes
    ├── catalog/       # categorías, catálogos simples, productos, búsqueda, imágenes
    ├── files/         # carga validada y almacenamiento (disco local)
    ├── inventory/     # lotes, kardex inmutable, existencias, FEFO, vencimientos
    ├── purchasing/    # proveedores, órdenes de compra, recepciones transaccionales
    ├── settings/      # datos de la farmacia, parámetros, métodos de envío, mensajerías, cuentas bancarias
    ├── storefront/    # catálogo público y reglas de venta en línea
    ├── pricing/       # cálculo único de importes (IVA incluido)
    ├── promotions/    # promociones y elección de la de mayor descuento
    ├── billing/       # tasas de impuesto, comprobante interno, datos FEL, ingresos
    ├── notifications/ # bandeja de salida de correos, despachador con reintentos, resumen de inventario
    ├── reports/       # dashboard por permisos y reportes de ventas e inventario
    ├── audit/         # interceptor de auditoría (solo inserción) y su consulta
    ├── cart/          # carrito del cliente
    ├── orders/        # checkout, estados del pedido, transferencias, cobro contra entrega,
    │                  #   envíos y seguimiento, devoluciones, reembolsos, vencimiento de reservas
    ├── mail/          # envío de correo (smtp | log)
    └── health/        # GET /api/v1/health
```

| Comando | Descripción |
|---|---|
| `pnpm start:dev` | Desarrollo con recarga |
| `pnpm build` / `pnpm start:prod` | Compilación y ejecución |
| `pnpm test` / `pnpm test:e2e` | Pruebas unitarias / e2e (PostgreSQL real) |
| `pnpm lint` | oxlint |
| `pnpm db:migrate` / `pnpm db:migrate:deploy` | Migraciones |
| `pnpm db:seed` | Datos base (requiere `pnpm build`) |

Ver [instalación](../docs/instalacion.md), [variables de entorno](../docs/variables-entorno.md) y [migraciones](../docs/migraciones.md).
