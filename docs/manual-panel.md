# Manual del panel administrativo

Guía breve para el personal de la farmacia. El panel está en `https://DOMINIO/admin`. Cada usuario entra con su correo, su contraseña y el código de su app autenticadora (Google Authenticator, Microsoft Authenticator u otra). El primer ingreso pide escanear un código QR y guardar los códigos de recuperación.

## Roles

Cada rol ve solo las secciones de sus permisos. Un administrador puede ajustar los permisos de cada rol en **Seguridad → Roles y permisos**.

| Rol | Tareas principales |
|---|---|
| Superadministrador | Todo, incluidos usuarios y roles |
| Administrador | Todo el panel, auditoría, reportes y correos enviados |
| Regente farmacéutico | Catálogo sanitario, **habilitar la venta en línea** de cada producto, cuarentena de lotes, inspección de devoluciones |
| Bodega | Existencias, recepción de compras, preparación y despacho de pedidos |
| Ventas | Pedidos, confirmación de contra entrega, entrega con cobro, devoluciones, promociones |
| Finanzas | Verificación de transferencias, reembolsos, aprobación de compras, comprobantes y FEL, ingresos, reportes |

## Rutina diaria

1. **Dashboard:** pedidos por atender, alertas de inventario y pendientes de Finanzas. Cada número lleva a su lista.
2. **Pagos por verificar** (Finanzas): comparar cada comprobante con el estado de cuenta del banco antes de aprobar. Si no coincide, rechazar con un motivo claro; el cliente lo recibe por correo y puede enviar otro.
3. **Contra entrega por confirmar** (Ventas): llamar o escribir al cliente si hace falta y confirmar. Si no se confirma a tiempo, el pedido vence solo y libera las unidades.
4. **Por preparar y por despachar** (Bodega): preparar y despachar con la mensajería y la guía. El sistema descuenta los lotes que vencen primero (FEFO) y avisa al cliente con el enlace de rastreo.
5. **Entregas** (Ventas): registrar la entrega. En contra entrega, registrar el monto cobrado; si difiere del total, explicar el motivo.
6. **FEL** (Finanzas): emitir la factura en el portal del certificador y registrar sus datos en **Facturación → Comprobantes y FEL**.

## Reglas que el sistema hace cumplir

- Solo se venden en línea productos de venta libre habilitados por el regente, de lotes disponibles con al menos 30 días de vida útil.
- Los precios, descuentos e impuestos los calcula el sistema; el cliente no puede alterarlos.
- Una devolución nunca vuelve sola al inventario: el regente decide si se reincorpora, se destruye o se devuelve al proveedor.
- Los movimientos de inventario no se editan: los errores se corrigen con un ajuste.
- Cada operación del personal queda en la **Auditoría** con usuario, fecha e IP.

## Si algo sale mal

| Situación | Qué hacer |
|---|---|
| Perdí mi teléfono con la app autenticadora | Usar un código de recuperación, o pedir a un administrador que restablezca el doble factor |
| Un cliente dice que no recibió un correo | **Configuración → Correos enviados**: buscar su correo, ver el estado y reintentar si falló |
| Un lote tiene un problema de calidad | **Inventario → Lotes y vencimientos**: ponerlo en cuarentena o retiro del mercado; deja de venderse al instante |
| Se aprobó un pago por error | Cancelar el pedido con el motivo; el sistema deja un reembolso pendiente para Finanzas |
