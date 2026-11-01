# ADR-008 · Impuestos, facturación básica, preparación FEL y promociones

- Fecha: 2026-11-01
- Estado: aprobada (Fase 8)

## Impuestos

1. **Precios con IVA incluido (D1):** el impuesto se desglosa de cada línea y del envío (ADR-006). Cada línea de pedido guarda la tasa que se le aplicó, así que **cambiar una tasa solo afecta las ventas siguientes**. Una prueba e2e lo verifica.
2. **Administración** (`billing.manage`): crear tasas (código fijo, nombre, porcentaje), editarlas y elegir la predeterminada; la anterior deja de serlo en la misma transacción. Un índice único parcial garantiza una sola predeterminada.
3. **Restricciones:** la tasa predeterminada no se puede desactivar ni dejar de serlo sin elegir otra, y no se desactiva una tasa que usan productos vigentes. El formulario de producto sigue leyendo las tasas activas desde el mismo servicio (`billing/tax-rates.service.ts`), sin duplicar la lógica.

## Comprobante interno (D11)

4. **Cuándo se emite:** automáticamente, en la misma transacción en que se confirma el pago. En transferencia, al aprobar el comprobante; en contra entrega, al registrar la entrega con el cobro (reglas de negocio §9). Es idempotente: un pedido tiene un solo comprobante.
5. **Contenido:**
   - copia los datos de facturación del pedido (NIT o CF, nombre y dirección) y sus líneas: descripción, cantidad, precio, descuento, IVA y total;
   - agrega el envío como **servicio** (`is_good = false`, dato que FEL exige);
   - los totales son los del pedido.
6. **No aparenta ser FEL:** lleva la leyenda «Documento interno — no constituye factura ni documento tributario. La factura electrónica (FEL) se emite por separado.», en un recuadro visible. Usa la numeración propia `CI-000001` y no imita el formato de un DTE. El cliente lo ve e imprime desde su pedido; el personal, desde Facturación.
7. **Anulación:** manual, con motivo y `billing.manage`, o automática al cancelar un pedido ya pagado. Si la FEL aún no se había registrado pasa a «no aplica». Si ya se registró, el sistema advierte que debe anularse también ante el certificador.

## Preparación FEL

8. **Registro manual:** la farmacia emite la FEL en el portal de su certificador y registra en el comprobante el número de autorización (UUID, único), la serie, el número de DTE, el certificador y la fecha de certificación. Un `CHECK` exige todos esos datos cuando el estado es CERTIFIED, y el comprobante queda marcado «FEL registrada».
9. **Integración futura:** el modelo ya tiene `invoices.kind = FEL`, `fel_status` y los datos del DTE, y las líneas tienen la información que pide un certificador (bien o servicio, IVA por línea, NIT del receptor). Integrarse con un certificador será un servicio que tome un comprobante, envíe el DTE, guarde la respuesta y marque CERTIFIED. No se agregó código de integración porque todavía no hay certificador elegido; el registro manual cubre la operación mientras tanto.

## Ingresos

10. **Reporte por rango de fechas** (zona de Guatemala; `billing.read`):
    - **recibido:** transferencias aprobadas por su fecha de verificación y cobros contra entrega por su fecha de cobro, desglosados por método;
    - **reembolsado:** reembolsos completados;
    - **neto:** recibido menos reembolsado;
    - **facturación:** comprobantes emitidos y anulados con su IVA, y comprobantes cuya FEL falta registrar.

    No es contabilidad de partida doble. El dashboard y los reportes completos llegan en la Fase 9.

## Promociones

11. **Definición:** porcentaje (hasta 100 %) o monto fijo por unidad, con inicio y fin (`timestamptz`; el panel trabaja en hora de Guatemala), estado activo y productos participantes. El precio normal del producto no cambia. La baja es lógica y los pedidos conservan la promoción aplicada (`order_items.promotion_id`).
12. **Reglas de cálculo** (`promotions/promotion-pricing.ts`, funciones puras con pruebas unitarias):
    - un porcentaje se redondea comercialmente a 2 decimales;
    - el descuento nunca supera el precio, y además un monto fijo debe ser **menor** que el precio de cada producto para que una promoción no regale productos;
    - las promociones **no se acumulan**: gana la de mayor descuento; a igual descuento, la que vence antes, y si persiste el empate, la de menor id.
13. **Dónde se aplica:** el catálogo muestra el precio normal y el de oferta, el carrito muestra el descuento por línea y el checkout lo **recalcula dentro de la transacción** con la hora de confirmación. Si una promoción terminó entre que el cliente vio el total y confirmó, responde `409 TOTAL_CHANGED` (ADR-006).
14. **Permisos:** `promotions.read` y `promotions.manage` (Administrador y Ventas; Finanzas solo consulta).

## Permisos nuevos

| Permiso | Uso | Roles iniciales |
|---|---|---|
| `billing.read` | Comprobantes, datos FEL, ingresos, tasas | Administrador, Finanzas |
| `billing.manage` | Tasas de impuesto, registro FEL, anulación | Administrador, Finanzas |
| `promotions.read` | Consultar promociones | Administrador, Ventas, Finanzas |
| `promotions.manage` | Crear, editar y dar de baja promociones | Administrador, Ventas |
