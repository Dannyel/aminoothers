# ADR-007 · Ventas, pagos, envíos y devoluciones

- Fecha: 2026-11-01
- Estado: aprobada (Fase 7)

## Estados del pedido

1. **Máquina de estados única** (`orders/order-status.ts`) con las transiciones de las reglas de negocio §6. Cada acción bloquea el pedido (`SELECT … FOR UPDATE`), valida que la transición esté permitida y registra el historial con usuario y nota en la misma transacción. El sistema registra con usuario nulo.
2. **Cancelación** (D8): el cliente puede cancelar antes de la confirmación (pendiente de pago, pago en revisión o pendiente de confirmación). El personal también puede cancelar pedidos confirmados o en preparación, con motivo obligatorio. Al cancelar:
   - se liberan las reservas (`RELEASED`) y se cancelan los pagos abiertos;
   - si el pago ya estaba aprobado, se crea un **reembolso pendiente** por el total para que Finanzas lo complete.
3. **Contra entrega:** el personal confirma el pedido antes de prepararlo. Al registrar la entrega se exige el monto cobrado y el permiso `payments.collect`; si el monto difiere del total, también se exige una nota. Cobro y entrega quedan en la misma operación.

## Pagos por transferencia

4. **Registro del cliente:** cuenta de destino, referencia, fecha y comprobante. El comprobante puede ser JPEG, PNG, WebP o PDF; se valida por su contenido y por un tamaño máximo (`MAX_PROOF_UPLOAD_MB`). Es un archivo **privado**: no se sirve por `/files` y el personal lo ve a través del BFF, con `Cache-Control: no-store` y `CSP sandbox`. Los PDF se descargan en lugar de abrirse, porque los visores de PDF no funcionan dentro de esa política.
5. **Validaciones:**
   - la fecha de la transferencia no puede ser futura ni tener más de 30 días;
   - el plazo de la reserva no puede haber vencido;
   - la **referencia no se repite** en la misma cuenta mientras el pago siga vigente (índice único parcial). Un pago rechazado o cancelado libera su referencia, para que el cliente pueda corregir un comprobante ilegible.
6. **Verificación manual** (`payments.verify`): aprobar confirma el pedido. Rechazar exige motivo; el pago rechazado queda en el historial y se abre un **pago nuevo**, con un plazo completo de reserva para el reintento. Mientras el comprobante está en revisión, la reserva no vence.
7. **Pasarelas futuras:** se agregarían con otro `provider` en `payments` y su propio flujo de confirmación, sin tocar el resto. No se guardan datos de tarjetas.

## Envíos

8. **Mensajerías** configurables, con una URL de rastreo que debe contener `{tracking}`. `integration_code` queda para conectar la API de la mensajería cuando se elija. Un método de envío puede indicar su mensajería habitual; la que realmente lleva el pedido se elige al despachar.
9. **Despacho:** crea el envío (mensajería, guía opcional, costo real) y **descuenta del inventario** los lotes reservados con un movimiento `SALE` por lote, a través del mismo servicio de kardex (ADR-005). La reserva queda `CONSUMED` con el id de su movimiento, así la trazabilidad pedido → línea → lote → movimiento es completa. Una guía no se repite en la misma mensajería.
10. **Seguimiento manual** con eventos de solo inserción (trigger). Los eventos «despachado» y «en tránsito» se registran a mano; los demás los generan las acciones del pedido: entregado, entrega fallida, nuevo intento y devuelto. El cliente ve la mensajería, la guía, el enlace de rastreo y los eventos, pero no el costo de la mensajería.
11. **Paquete devuelto a la farmacia:** crea automáticamente una devolución ya recibida con todas las unidades **pendientes de inspección**, que no vuelven solas al inventario. También se cancela el cobro contra entrega que no ocurrió.

## Devoluciones (D7)

12. **Registro:** las registra el personal sobre pedidos entregados, dentro de `return_window_days` (7 por defecto, configurable) contados desde la entrega. Las unidades se asignan a los **lotes de origen** según las reservas consumidas, sin superar lo ya devuelto de cada lote.
13. **Estados:** registrada → aprobada → recibida → cerrada, o rechazada. Rechazar libera las unidades para otra devolución.
14. **Inspección** (`returns.inspect`, Regente), por línea:
    - **reincorporar** crea un movimiento `RETURN_RESTOCK` al lote original, solo si sigue disponible y vigente;
    - **destruir** o **devolver al proveedor** no crean movimiento, porque la unidad ya había salido con la venta.

    Con todas las líneas inspeccionadas la devolución se cierra.
15. **Reembolsos:** se registran como pendientes y después se completan con su referencia, o se anulan. La suma de pendientes y completados nunca supera lo pagado (lo cobrado en contra entrega). Un reembolso puede ligarse a una devolución. El pago pasa a reembolsado parcial o totalmente.

## Permisos

| Permiso | Uso | Roles iniciales |
|---|---|---|
| `orders.read` | Consultar pedidos, pagos, envíos y devoluciones | Todos los del personal |
| `orders.manage` | Confirmar contra entrega, preparar, cancelar | Ventas, Bodega |
| `shipments.manage` | Despachar, seguimiento, entrega, fallida, reenvío, paquete devuelto | Ventas, Bodega |
| `payments.verify` | Aprobar o rechazar transferencias y ver comprobantes | Finanzas |
| `payments.collect` | Registrar el cobro contra entrega | Ventas, Finanzas |
| `refunds.manage` | Registrar, completar y anular reembolsos | Finanzas |
| `returns.manage` | Registrar, aprobar, rechazar y recibir devoluciones | Ventas, Bodega |
| `returns.inspect` | Decidir el destino de las unidades devueltas | Regente |

El Administrador tiene todos. Las cuentas bancarias y las mensajerías se configuran con `settings.manage`.

## Pendiente

- **Correos** de cambio de estado, transferencia aprobada o rechazada, despacho, entrega y cancelación: Fase 9, con la bandeja de salida y sus reintentos.
- **Comprobante interno y datos de FEL** (D11): Fase 8. **Auditoría** de estas operaciones: Fase 9; ya quedan en los historiales con usuario.
- **Advertencia conocida:** Prisma 7.10 con `adapter-pg` muestra en las pruebas una advertencia de `pg` («client.query() when the client is already executing a query») al ejecutar consultas anidadas dentro de transacciones interactivas. Es interna del cliente de Prisma, ya aparecía en la Fase 5 y no afecta el resultado.
