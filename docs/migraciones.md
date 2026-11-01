# Migraciones (Prisma 7)

- Esquema: `backend/prisma/schema.prisma`
- Configuración del CLI: `backend/prisma.config.ts` (URL de la base y de la base sombra)
- Migraciones: `backend/prisma/migrations/`
- Cliente generado: `backend/src/generated/prisma/` (no se versiona; se genera en `pnpm install` y `pnpm build`)

## Comandos (desde `backend/`)

| Comando | Uso |
|---|---|
| `pnpm db:migrate` | Desarrollo: genera una migración a partir de los cambios del esquema y la aplica (`prisma migrate dev`) |
| `pnpm db:migrate -- --create-only --name <nombre>` | Crea la migración sin aplicarla, para editar el SQL (índices parciales, triggers, `CHECK`) |
| `pnpm db:migrate:deploy` | Aplica las migraciones pendientes. Es el único comando permitido en producción |
| `pnpm db:migrate:status` | Estado de las migraciones |

## Reglas

1. Las tablas se agregan en la fase que las usa, siguiendo el modelo aprobado (`docs/fase-1/02-modelo-de-datos.md`).
2. Una migración aplicada no se edita: se corrige con una migración nueva.
3. Lo que Prisma no expresa en el esquema (índices parciales y GIN, columnas generadas, `CHECK`, triggers de inmutabilidad) se escribe en SQL dentro de la migración, creada con `--create-only`, y se comenta.
4. Nunca se usa `prisma migrate reset` ni `db push` contra una base con datos reales.

## Historial

| Migración | Contenido |
|---|---|
| `20261031000000_init_extensions` | Extensiones `citext`, `pg_trgm`, `unaccent` |
| `20261031235116_users_and_security` | Fase 3: `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `customers`, `customer_addresses`, `sessions`, `user_tokens`. SQL propio: `CHECK` de intentos y nombres, índice parcial de sesiones vigentes, índice único parcial de una dirección predeterminada por cliente |
| `20261101002712_two_factor_auth` | Doble factor: columnas `totp_secret`, `totp_enabled_at`, `totp_last_step` en `users`; tablas `mfa_challenges` y `user_recovery_codes`; `CHECK` de secreto obligatorio si está activo |

| `20261101004339_catalog` | Fase 4: `files`, `tax_rates` (con IVA 12 % y EXENTO), `categories`, `subcategories`, `brands`, `manufacturers`, `presentations`, `concentrations`, `active_ingredients`, `tags`, `products`, `product_active_ingredients`, `product_images`, `product_tags`. SQL propio: slugs y código de barras únicos entre registros vigentes, FK compuesta subcategoría–categoría, `CHECK` de precio, de controlados y de aprobación en línea, una imagen principal por producto, función `immutable_unaccent` e índices de trigramas |
| `20261101041358_inventory_and_purchasing` | Fase 5: `store_settings` (fila única con vida útil mínima 30 y alerta 90 días), `warehouses` (bodega PRINCIPAL), `lots`, `inventory_movements`, `suppliers`, `purchase_orders`, `purchase_order_items`, `purchase_receipts`, `purchase_receipt_items`. SQL propio: `CHECK` de existencias, de signo por tipo de movimiento y de cantidades de compra; trigger de inmutabilidad del kardex |
| `20261101043634_storefront_and_checkout` | Fase 6: datos de la farmacia y parámetros de pedidos en `store_settings`, `shipping_methods`, `carts`, `cart_items`, `orders`, `order_items`, `order_status_history`, `stock_reservations`, `payments`, `payment_status_history`. SQL propio: `CHECK` de importes del pedido y de cada línea, NIT de facturación, un solo pago vigente por pedido, índice de reservas por vencer y triggers de solo inserción en los historiales |
| `20261101070000_sales_payments_shipping` | Fase 7: `bank_accounts`, `couriers`, `shipments`, `shipment_events`, `returns`, `return_items`, `refunds`; columnas de transferencia, verificación y cobro en `payments`; cancelación en `orders`; `quantity_returned` en `order_items`; `consumed_movement_id` en `stock_reservations`; `courier_id` en `shipping_methods`; `return_window_days` en `store_settings`. SQL propio: referencia bancaria única por cuenta mientras el pago siga vigente, guía única por mensajería, plantilla de rastreo con `{tracking}`, `CHECK` de cantidades e importes y trigger de solo inserción en `shipment_events`. Generada con `prisma migrate diff` porque `migrate dev` pide confirmar índices únicos de forma interactiva |
| `20261101090000_billing_and_promotions` | Fase 8: `invoices`, `invoice_items`, `promotions`, `promotion_products`; `promotion_id` en `order_items`. SQL propio: importes no negativos, anulación con fecha y motivo, datos FEL completos cuando está registrada, vigencia y valor de las promociones, índice de promociones activas. Generada con `prisma migrate diff` |
| `20261101110000_notifications_and_audit` | Fase 9: `notification_logs` (bandeja de salida con reintentos y `dedupe_key`), `audit_logs` (BIGSERIAL), `store_settings.staff_alert_email`. SQL propio: trigger de solo inserción en la auditoría, `sent_at` obligatorio al enviarse, índice parcial de pendientes. Generada con `prisma migrate diff`. Requiere `pnpm db:seed` para cargar los permisos `reports.read`, `notifications.manage` y `audit.read` |
| `20261101130000_audit_retention` | Fase 10 (D20): el trigger de la auditoría permite borrar solo registros de más de 5 años; nunca modificarlos. Sin cambios de esquema |

## Datos base (seed)

`pnpm db:seed` (después de `pnpm build`) sincroniza el catálogo de permisos y los roles de sistema desde `src/modules/roles/permissions.catalog.ts`, y crea el superadministrador inicial si no existe (ver `INITIAL_ADMIN_*` en [variables de entorno](variables-entorno.md)). Es idempotente: se ejecuta después de cada despliegue que agregue permisos. A los roles de sistema solo se les agregan los permisos **nuevos** del catálogo; nunca se les devuelven los que un administrador haya quitado.
