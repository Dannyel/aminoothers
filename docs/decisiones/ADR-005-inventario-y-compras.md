# ADR-005 · Inventario por lotes y compras

- Fecha: 2026-11-01
- Estado: aprobada (Fase 5)

## Inventario

1. **Una sola bodega** (`warehouses`, fila `PRINCIPAL` creada por la migración). No hay pantalla para crear bodegas ni transferencias.
2. **La existencia vive en `lots`** (física `qty_on_hand` y reservada `qty_reserved`). Disponible, vencida, en cuarentena y próxima a vencer se **calculan** con SQL desde los lotes; no hay tablas de saldos que puedan desincronizarse.
   - **Disponible** = lotes `AVAILABLE` con vencimiento ≥ hoy + vida útil mínima (D4: 30 días), menos lo reservado.
   - **Vencida** se calcula por fecha (zona America/Guatemala), nunca por un estado que haya que actualizar.
3. **`StockLedgerService` es el único punto que cambia la existencia física.** Bloquea el lote (`SELECT … FOR UPDATE`), valida que no quede por debajo de lo reservado, actualiza el lote y el costo promedio ponderado, y registra el movimiento con su saldo, todo en la misma transacción. Una prueba e2e con salidas simultáneas confirma que nunca queda negativo, y otra prueba verifica que el saldo de cada lote es igual a la suma de sus movimientos.
4. **Kardex inmutable:** un trigger impide `UPDATE` y `DELETE` en `inventory_movements`. Los errores se corrigen con un ajuste que puede referenciar el movimiento corregido. Un `CHECK` exige que el signo de la cantidad corresponda al tipo de movimiento.
5. **Movimientos de esta fase:** existencia inicial (`ADJUSTMENT_IN` / `INITIAL_STOCK`), ajustes de entrada y salida con motivo y explicación obligatoria, bajas (`WRITE_OFF`: vencido, dañado, retiro del mercado u otro), devolución al proveedor (`RETURN_TO_SUPPLIER`) y recepciones de compra. `SALE` y `RETURN_RESTOCK` llegan con los pedidos (Fases 6 y 7).
6. **Vencimiento obligatorio para medicamentos**, entendidos como los productos con al menos un principio activo. Nunca se ingresa un lote ya vencido.
7. **Estados de lote:** cuarentena, retiro del mercado y bloqueo sacan el lote de la venta de inmediato. Exigen motivo y el permiso `inventory.quarantine` (Regente). Si el lote tiene unidades reservadas, el cambio se rechaza hasta gestionar esos pedidos.
8. **FEFO** (`fefo.ts`): función pura con pruebas unitarias que reparte una cantidad entre lotes del que vence antes al que vence después (los que no vencen al final; a igual fecha, el más antiguo). La usarán las reservas del checkout en la Fase 6.
9. **Parámetros** en `store_settings` (fila única): vida útil mínima para vender y umbral de "próximo a vencer". Se editan desde Existencias con `inventory.settings`.

## Compras

10. **Estados de la orden:** `DRAFT` → `APPROVED` → `PARTIALLY_RECEIVED` / `RECEIVED`; además `CLOSED` (recibida parcialmente, se cierra con faltante) y `CANCELLED` (solo sin recepciones). Solo los borradores se editan.
11. **Costos sin IVA**; el impuesto de cada línea se toma de la tasa del producto (un producto exento no paga IVA). El redondeo comercial a 2 decimales se aplica por línea con `Decimal`.
12. **Recepción en una sola transacción y sin borradores.** La orden se bloquea; se validan las cantidades pendientes (una línea puede llegar en varios lotes) y los vencimientos; se crean o incrementan los lotes, se registran las entradas y se actualiza la orden. Cualquier error revierte todo. Se omitió el estado "borrador" de la recepción del modelo de la Fase 1 porque no aportaba valor: una recepción registrada es definitiva y se corrige con ajustes.
13. **Lote existente:** si el número de lote ya existe para el producto, la recepción se suma a ese lote solo si coinciden el vencimiento y el estado; si no coinciden, se rechaza para evitar errores de digitación.
14. **Estado inicial de lo recibido:** disponible o cuarentena, a elección (D6).
15. **Permisos:**

| Permiso | Uso | Roles iniciales |
|---|---|---|
| `inventory.read` | Consultar existencias y kardex | Bodega, Regente, Finanzas |
| `inventory.adjust` | Existencia inicial, ajustes y bajas | Bodega |
| `inventory.quarantine` | Cuarentena, retiro, bloqueo y liberación | Regente |
| `inventory.settings` | Parámetros de vencimiento | — |
| `purchases.read` | Consultar compras y proveedores | — |
| `purchases.manage` | Proveedores y órdenes de compra | Bodega |
| `purchases.approve` | Aprobar, cancelar y cerrar órdenes | Finanzas |
| `purchases.receive` | Registrar recepciones | Bodega |

El Administrador tiene todos.

## Pendiente

- Reservas (`stock_reservations`) y su expiración: Fase 6. Las ventas que descuentan lotes: Fase 7.
- La auditoría de movimientos, compras y cambios de estado de lotes: Fase 9. El kardex ya registra quién hizo cada movimiento.
