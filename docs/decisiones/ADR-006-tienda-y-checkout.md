# ADR-006 · Tienda en línea, carrito y checkout

- Fecha: 2026-11-01
- Estado: aprobada (Fase 6)

## Catálogo público

1. **Qué se muestra:** productos vigentes y activos de categorías activas. Los que requieren receta o son controlados aparecen como informativos («Venta solo en farmacia», D2), sin botón de compra. No hay recomendaciones, productos relacionados ni sustitutos.
2. **Qué se puede comprar** (`storefront/sale-rules.ts`, función única que usan la tienda, el carrito y el checkout): el producto debe estar activo, ser de venta libre, tener la habilitación regulatoria y tener existencia vendible. La existencia vendible sale de los lotes (ADR-005): disponibles, con vida útil suficiente y sin reservar.
3. **Disponibilidad visible:** disponible, últimas unidades (hasta 5), agotado, venta solo en farmacia o no disponible en línea. Al cliente no se le muestra la existencia exacta, solo `maxQuantity`, que es el menor entre lo disponible y el máximo por pedido.
4. **Búsqueda y filtros:** se reutiliza la búsqueda sin tildes de la Fase 4 (nombre, marca, principio activo, SKU, código de barras). Se filtra por categoría, subcategoría y marca, y se ordena por nombre, precio o novedad. La respuesta incluye las marcas presentes para armar el filtro.

## Carrito

5. **Lo que se guarda:** solo producto y cantidad. Precio, impuesto, disponibilidad y totales se calculan en cada consulta con `pricing/pricing.ts`, el mismo cálculo que usa el checkout.
6. **Al agregar** se valida que el producto se venda en línea, que haya existencia y el máximo por pedido. Las líneas que después dejan de poder comprarse (sin habilitación, agotadas, cantidad mayor a la disponible) se marcan con su motivo, no cuentan en el total y bloquean el checkout hasta corregirlas.
7. **Límites:** solo clientes autenticados. Hasta 30 productos distintos y hasta `max_units_per_product` unidades por producto (10 por defecto, configurable).

## Precios e impuestos

8. **IVA incluido (D1):** el impuesto se desglosa del total de cada línea (`total − total / (1 + tasa)`), redondeado a 2 decimales por línea. El envío es un servicio gravado con la tasa predeterminada y su IVA se guarda en `orders.shipping_tax`.
9. **Total = Σ líneas − descuentos + envío.** Un `CHECK` lo garantiza en `orders`, y otro garantiza las cuentas de cada `order_items`. Los descuentos valen 0 hasta las promociones de la Fase 8; la estructura ya los contempla.

## Checkout

10. **Una sola transacción:**
    1. Bloquea el carrito del cliente.
    2. Valida los productos, la dirección propia, el método de envío y el pago contra entrega si aplica.
    3. Recalcula los importes y compara con `expectedTotal`, el total que vio el cliente; si no coincide, responde `409 TOTAL_CHANGED`.
    4. Crea el pedido con copias del cliente, la dirección, el envío y cada producto.
    5. Crea el historial inicial y el pago `PENDING`.
    6. Reserva los lotes por FEFO (`ReservationsService`, único punto que cambia `qty_reserved`).
    7. Vacía el carrito.

    Si cualquier paso falla se revierte todo; si falta existencia, responde `409 INSUFFICIENT_STOCK` indicando lo disponible.
11. **Concurrencia:** los lotes se bloquean con `FOR UPDATE` siempre en el mismo orden: por producto y luego FEFO, también al liberar. El `CHECK qty_reserved <= qty_on_hand` es la última defensa. Una prueba e2e con 6 checkouts simultáneos sobre 10 unidades confirma que se aceptan exactamente 3 pedidos de 3. Los interbloqueos o serializaciones que detecte PostgreSQL se responden con `409` («intente de nuevo»).
12. **Idempotencia:** la cabecera `Idempotency-Key` (UUID) es obligatoria y única por cliente. Reenviar la misma clave devuelve el pedido ya creado. El BFF genera una clave por cada vez que muestra la página de checkout.
13. **Requisitos del cliente:** correo verificado (D13). NIT opcional; si no se indica, se usa el del perfil o CF, con el nombre «Consumidor final» (D12).
14. **Estado inicial:** transferencia → `PENDING_PAYMENT`, con reserva de 24 h; contra entrega → `PENDING_CONFIRMATION`, con reserva de 48 h (D3). Ambos plazos se configuran en el panel.
15. **Confirmación al cliente:** página de confirmación y correo enviado después de confirmar la transacción. Si el correo falla, el pedido no se revierte. El correo aclara que no es factura.

## Vencimiento de reservas

16. **Qué hace:** `ReservationExpiryService` revisa cada `RESERVATION_SWEEP_INTERVAL_SECONDS` (300 por defecto; 0 lo desactiva, como en las pruebas). Vence los pedidos pendientes cuya `reservation_expires_at` pasó: libera las reservas (`EXPIRED`), pasa el pedido a `EXPIRED` y el pago pendiente a `CANCELLED`, con historial marcado como acción del sistema.
17. **Varias instancias:** usa `pg_try_advisory_xact_lock` y `FOR UPDATE SKIP LOCKED`, así que solo una instancia procesa a la vez y sin Redis ni colas. Se descartó `@nestjs/schedule` por ser una dependencia innecesaria para un solo intervalo.
18. **Excepción:** un pedido con comprobante en revisión (`PAYMENT_IN_REVIEW`) no vence. Esa transición llega en la Fase 7.

## Configuración

19. **Datos de la farmacia** en `store_settings` (fila única): nombre comercial, razón social, NIT, dirección, contacto, horario, logotipo, licencia sanitaria, regente y leyenda regulatoria (D19). También los parámetros de pedidos: plazos de reserva y máximo de unidades por producto. Se editan con el permiso nuevo `settings.manage` (Administrador).
20. **Métodos de envío** con tarifa fija (D5) y plazo estimado. Cada uno indica si admite pago contra entrega. La baja es lógica y los pedidos conservan el nombre y el costo que pagaron. La asociación con mensajerías llega en la Fase 7.

## Fuera de esta fase

- Cuentas bancarias, carga y verificación del comprobante, cobro contra entrega, cancelación por el cliente (D8) y la gestión de pedidos del panel: Fase 7. Mientras tanto, un pedido por transferencia vence si no se paga en el plazo.
- Promociones (Fase 8). Notificaciones de cambio de estado y vencimiento, y bandeja de salida con reintentos (Fase 9).
