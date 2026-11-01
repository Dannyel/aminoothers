# ADR-009 · Dashboard, reportes, notificaciones y auditoría

- Fecha: 2026-11-01
- Estado: aprobada (Fase 9)

## Notificaciones por correo (bandeja de salida)

1. **Encolar en la transacción del evento.** Los avisos se guardan en `notification_logs` dentro de la misma transacción que la operación que los origina (`notifications/outbox.ts`). Si la operación se revierte, el aviso no existe. Si se confirma, se envía aunque el servidor de correo esté caído en ese momento. Una falla del correo nunca revierte una operación de negocio (reglas de negocio §12).
2. **Un único punto para los pedidos.** `transitionOrder` encola el aviso de cada cambio de estado, así ninguna transición, actual o futura, se queda sin su correo:
   - **al cliente:** confirmado (distingue transferencia aprobada de contra entrega confirmado), comprobante rechazado con su motivo y nuevo plazo, enviado (mensajería, guía y enlace de rastreo), entregado, entrega fallida, devuelto a la farmacia, cancelado con su motivo y vencido;
   - **sin aviso:** «en preparación» y el envío del comprobante, que es una acción del mismo cliente;
   - **al personal:** cuando un cliente sube un comprobante, aviso al buzón `store_settings.staff_alert_email`.

   El pedido recibido se encola en la transacción del checkout. Antes se enviaba después de confirmar la transacción.
3. **Datos al encolar, correo al enviar.** Se guardan el tipo, el destinatario y los datos del evento (`payload`). El correo se arma al enviarse con las plantillas de `notification-templates.ts`, que escapan el HTML del texto del usuario. El asunto enviado queda registrado.
4. **Despachador** (`NotificationDispatcherService`, cada `NOTIFICATION_DISPATCH_INTERVAL_SECONDS`; 0 lo desactiva y así corren las pruebas):
   - **reclamo:** toma un lote con `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)`, suma el intento y deja una espera de 5 minutos, por si el proceso cae a media entrega. Varias instancias nunca toman el mismo correo;
   - **envío:** fuera de la transacción;
   - **reintentos:** tras los intentos 1 a 4 espera 1, 5, 15 y 60 minutos; al quinto fallo el correo queda `FAILED`;
   - **garantía:** al menos una entrega. Si el proceso cae justo después de enviar, el correo puede repetirse; nunca se pierde.
5. **Resumen diario de inventario:** desde `INVENTORY_DIGEST_HOUR` (7 h en Guatemala), una vez al día y solo si hay buzón del personal y alguna alerta (vencidos, retirados, cuarentena, próximos a vencer, existencias bajas). La clave única `dedupe_key = INVENTORY_DIGEST:AAAA-MM-DD` evita duplicados entre instancias.
6. **Correos de autenticación fuera de la bandeja.** Verificación, recuperación, invitación, cambio de contraseña y doble factor se siguen enviando directo, sin propagar errores. Varios contienen enlaces de un solo uso: guardarlos en la base dejaría credenciales válidas legibles para quien consulte la bandeja. El usuario puede volver a pedirlos desde la pantalla correspondiente.
7. **Panel** (`notifications.manage`, Administrador): lista con filtros, vista previa del texto del correo, último error y **reintento** de los fallidos, que reinicia sus intentos.

## Auditoría

8. **Registro automático de lo que hace el personal.** Un interceptor global (`AuditInterceptor`) registra toda operación exitosa del personal que modifica datos (POST, PUT, PATCH y DELETE):
   - **quién y qué:** usuario, endpoint (`action` = nombre del método, `route` = `PUT /admin/products/:id`), módulo (primer segmento de la ruta) e id del registro;
   - **datos:** lo enviado, sin secretos, y el nombre, tipo y tamaño del archivo si lo hay;
   - **origen:** la IP y el navegador.

   Así se cubren todas las operaciones de la §11 sin código de auditoría en cada servicio, y un endpoint nuevo queda auditado sin hacer nada. Las consultas sensibles se marcan con `@AuditRead()`; hoy, ver un comprobante de pago.
9. **Valores anteriores donde importan.** Precio y demás datos del producto, configuración de la tienda, roles y permisos, y datos, roles y estado de los usuarios guardan el antes y el después de los campos que cambiaron (`recordChanges`).
10. **Contexto de la petición.** La IP y el navegador viajan en un `AsyncLocalStorage` que abre un middleware de Express. La IP real llega desde el BFF en `X-Forwarded-For` (`TRUST_PROXY`). El proxy del comprobante también la reenvía.
11. **Inicios de sesión del personal:** `LOGIN` (con contraseña y doble factor completos), `LOGIN_FAILED` (en la contraseña o en el código) y `ACCOUNT_LOCKED`. Los de los clientes no se registran; ya tienen bloqueo por intentos.
12. **Inmutable:** un trigger impide `UPDATE` y `DELETE`. Las operaciones de los clientes no se auditan; sus pedidos, pagos y envíos ya tienen historiales con usuario.
13. **Momento de escritura:** después de confirmarse la operación, antes de responder. Si esa escritura fallara, la operación ya ocurrió: se registra el error en el log y no se altera la respuesta. Se aceptó este riesgo, muy bajo, a cambio de no modificar cada transacción. Los movimientos de inventario y los historiales de pedidos, pagos y envíos siguen siendo además registros inmutables dentro de su propia transacción.
14. **Consulta** (`audit.read`, Administrador): filtros por módulo, usuario, id del registro, texto y fechas, con el detalle en JSON.

## Dashboard y reportes

15. **Dashboard** (`/admin/dashboard`, cualquier usuario del personal):
    - **pedidos por atender** (`orders.read`);
    - **ventas** de hoy, 7 días y mes en curso, gráfico de 30 días y más vendidos (`reports.read`);
    - **reembolsos pendientes y FEL por registrar** (`billing.read`);
    - **alertas de inventario** (`inventory.read`);
    - **correos en cola y fallidos** (`notifications.manage`).

    El backend calcula una sección solo si el usuario tiene el permiso correspondiente; si no, la devuelve nula.
16. **Qué es una venta.** Un pedido confirmado que no se canceló ni regresó sin entregarse: confirmado, en preparación, enviado, entregado o con entrega fallida. Se cuenta por la fecha en que se hizo, en hora de Guatemala. Los montos incluyen IVA y son brutos; las devoluciones y reembolsos están en el reporte de Ingresos (ADR-008), que cuenta el dinero por la fecha en que se recibió.
17. **Reportes** (`reports.read`: Administrador y Finanzas), con un rango máximo de 366 días:
    - ventas por día, con totales, ticket promedio y desglose por forma de pago;
    - productos más vendidos;
    - ventas por categoría, con su porcentaje;
    - inventario valorizado: existencia × costo promedio de cada lote, separando lo no vendible.
18. **CSV:** el BFF lo genera a partir del mismo JSON (`/admin/reportes/csv`), sin agregar un endpoint en la API:
    - lleva BOM UTF-8 para Excel;
    - escapa comillas y separadores;
    - neutraliza fórmulas: un texto que empieza con `=`, `+`, `-` o `@` se antepone con `'`.

## Permisos nuevos

| Permiso | Uso | Roles iniciales |
|---|---|---|
| `reports.read` | Indicadores de ventas del dashboard y reportes | Administrador, Finanzas |
| `notifications.manage` | Bandeja de correos y reintentos | Administrador |
| `audit.read` | Registro de auditoría | Administrador |

## Variables nuevas

| Variable | Valor por defecto | Para qué |
|---|---|---|
| `NOTIFICATION_DISPATCH_INTERVAL_SECONDS` | `30` | Cada cuánto se envía la bandeja |
| `INVENTORY_DIGEST_HOUR` | `7` | Hora de Guatemala del resumen diario |

`store_settings.staff_alert_email` es el buzón del personal y se configura en el panel.

## Pendiente

- **Producción:** cuenta SMTP del dominio con SPF, DKIM y DMARC (riesgo de spam, ADR de la Fase 1).
- **Retención:** no se definió por cuánto tiempo se conservan la auditoría y los correos enviados. Se decidirá en la Fase 10, con las políticas de respaldo.
