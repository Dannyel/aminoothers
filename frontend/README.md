# Frontend · Tienda y panel administrativo

SvelteKit 3 + Svelte 5 + Tailwind CSS 4, desplegado con `adapter-node`. SvelteKit actúa como BFF: el navegador solo habla con este servidor y el servidor llama a la API.

```
src/
├── env.ts               # declaración y validación de variables (API_URL)
├── hooks.server.ts      # sesión (cookies httpOnly + renovación) y cliente de la API por petición
├── lib/
│   ├── api/             # tipos generados desde Swagger (pnpm gen:api) y alias
│   ├── server/          # cliente HTTP, sesión, helpers de formularios (solo servidor)
│   ├── components/      # ui/ reutilizables, admin/, formularios compartidos
│   └── admin-menu.ts    # menú del panel filtrado por permisos
└── routes/
    ├── (store)/         # tienda: inicio, categorías, productos (búsqueda y detalle), carrito, checkout,
    │                    #   login (+ doble factor), registro, recuperación, cuenta/ (pedidos, perfil…)
    ├── admin/login/     # contraseña, verificación y configuración del doble factor
    ├── admin/(panel)/   # panel: dashboard, reportes (+ CSV), auditoría, correos enviados, productos, categorías, catálogos, existencias, lotes, movimientos,
    │                    #   compras, proveedores, pedidos, pagos, devoluciones, reembolsos,
    │                    #   promociones, comprobantes y FEL, ingresos, impuestos,
    │                    #   clientes, usuarios, roles, configuración, métodos de envío,
    │                    #   mensajerías, cuentas bancarias, cuenta
    ├── media/[id]       # imágenes públicas (proxy de /api/v1/files)
    ├── logout           # cierre de sesión (POST)
    └── health/          # estado del frontend, la API y la base de datos
```

| Comando                     | Descripción                                         |
| --------------------------- | --------------------------------------------------- |
| `pnpm dev`                  | Desarrollo en http://localhost:5173                 |
| `pnpm build` / `node build` | Producción                                          |
| `pnpm check`                | Verificación de tipos                               |
| `pnpm test`                 | Pruebas unitarias                                   |
| `pnpm lint` / `pnpm format` | Prettier + ESLint                                   |
| `pnpm gen:api`              | Regenera los tipos de la API (backend en ejecución) |

Ver [instalación](../docs/instalacion.md) y [variables de entorno](../docs/variables-entorno.md).
