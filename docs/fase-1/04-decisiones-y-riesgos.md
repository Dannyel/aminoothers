# Fase 1 · Decisiones pendientes, riesgos y dependencias

> Estado: **aprobado el 2026-10-31**. Se adoptan las recomendaciones de cada decisión. Cualquier cambio posterior se registra como ADR en `docs/decisiones/`.

## 1. Decisiones pendientes

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| D1 | ¿Los precios incluyen IVA? | a) Incluyen IVA 12 % · b) Precio + IVA | **a)** Es lo habitual en el comercio minorista en Guatemala; el IVA se desglosa por línea. Tasa `EXENTO` disponible por producto si aplica |
| D2 | Venta en línea de medicamentos con receta | a) v1 solo venta libre (OTC); los de receta se muestran como "venta en farmacia" · b) Permitir con carga de receta y aprobación del regente | **a)** hasta que un profesional confirme la base legal. El modelo (`order_prescriptions`, estado `PRESCRIPTION_REVIEW`) queda listo para activar b) sin migraciones mayores. Controlados: nunca en línea |
| D3 | Tiempo de reserva | Transferencia: horas para subir comprobante · Contra entrega: horas para que el personal confirme | **24 h** transferencia, **48 h** contra entrega (configurables) |
| D4 | Vida útil mínima para vender y umbral "próximo a vencer" | días | No vender lotes con menos de **30 días** de vida útil; alertar a **90 días** (configurables) |
| D5 | Cálculo del costo de envío | a) Tarifa fija por método de envío · b) Tarifa por departamento/zona · c) Envío gratis desde un monto | **a)** en v1 (p. ej. "Capital", "Departamentos", "Express"). b/c se pueden agregar después |
| D6 | Estado inicial de los lotes recibidos | a) Disponible · b) Cuarentena hasta liberación del regente | **Elegible por recepción**, con valor por defecto **Disponible**; el regente puede enviar a cuarentena |
| D7 | Devoluciones | ¿Quién las inicia? ¿Plazo? ¿Qué productos se aceptan? | **Solo el personal** las registra en v1 (el cliente solicita por contacto); plazo **7 días** desde la entrega; productos de cadena de frío o abiertos no se reintegran (disposición `DESTROY`) |
| D8 | Cancelación por el cliente | Hasta qué estado | Hasta antes de `CONFIRMED` |
| D9 | Proveedor de correo | SMTP genérico, Resend, Amazon SES, etc. | **SMTP** (nodemailer) detrás de interfaz; en desarrollo, Mailpit en docker |
| D10 | Almacenamiento de archivos | Disco local · S3 compatible | **Disco local** (volumen respaldado) detrás de interfaz |
| D11 | Facturas mientras no exista FEL | a) Solo comprobante interno · b) Comprobante interno + registro manual de los datos de la FEL emitida externamente | **b)** Permite cumplir con FEL desde el día uno (emitiéndola en el portal del certificador) y dejar la referencia en el pedido |
| D12 | NIT en el checkout | Obligatorio / opcional con "CF" | Opcional, por defecto **CF**; editable por pedido |
| D13 | Verificación de correo | Obligatoria para comprar / no | **Obligatoria** antes del primer pedido |
| D14 | Productos no medicamentos (higiene, cosméticos) | ¿También por lotes? | **Sí**, todos los productos usan lotes; la fecha de vencimiento es opcional para no perecederos. Un solo flujo de inventario |
| D15 | Medicamentos combinados | Un principio activo por producto / varios | **Varios** (tabla puente); la concentración se describe con una etiqueta ("875 mg + 125 mg") |
| D16 | Fabricante | Texto libre / catálogo | **Catálogo** (`manufacturers`) para evitar duplicados al buscar y reportar |
| D17 | Despliegue | VPS con Docker Compose / PaaS | **VPS con Docker Compose** + proxy con TLS; confirmar proveedor y dominio |
| D18 | Gestor de paquetes | npm / pnpm | **pnpm** |
| D19 | Información regulatoria a mostrar | Leyendas obligatorias, datos del regente farmacéutico, licencia sanitaria del establecimiento | Configurable en `store_settings`; el texto exacto lo debe proveer el regente |
| D20 | Retención de datos *(decidida en la Fase 10)* | Plazos de auditoría, correos y respaldos | **Auditoría 5 años, correos enviados 180 días, respaldos 14 diarios + 12 mensuales** (ADR-010) |

## 2. Riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| **Regulatorio**: la venta en línea de ciertos medicamentos puede estar restringida (MSPAS / Departamento de Regulación y Control de Productos Farmacéuticos y Afines) | Alta | Alto | `online_sale_enabled` por producto con aprobación registrada, OTC solamente en v1 (D2), controlados bloqueados por `CHECK`. Validación con un profesional competente **antes** de producción |
| Sobreventa por concurrencia | Media | Alto | `SELECT … FOR UPDATE` en orden fijo, `CHECK` en BD, prueba e2e con checkouts paralelos |
| Prisma no expresa `FOR UPDATE`, índices parciales, columnas generadas ni triggers | Alta | Medio | SQL crudo parametrizado acotado al módulo `inventory`; migraciones SQL personalizadas documentadas |
| Comprobantes de transferencia falsos o reutilizados | Media | Alto | Verificación manual contra el estado de cuenta, referencia única por cuenta, hash del archivo, auditoría |
| Datos sensibles (recetas = datos de salud) | Media | Alto | Archivos privados, descarga con permiso, acceso auditado, retención definida; no habilitar recetas sin D2 |
| Correos en spam | Media | Medio | SPF/DKIM/DMARC en el dominio, proveedor SMTP confiable |
| FEL obligatoria en Guatemala para la mayoría de contribuyentes | Alta | Alto | D11 (registro manual), modelo listo para el certificador |
| Errores de redondeo | Baja | Medio | `Decimal` de extremo a extremo, una sola implementación en `pricing`, pruebas con casos límite |
| Zona horaria en vencimientos y reportes | Media | Medio | `DATE` para vencimientos, "hoy" calculado en `America/Guatemala` |
| Jobs duplicados si se escala horizontalmente | Baja | Medio | `pg_try_advisory_lock` |
| Alcance amplio (55 tablas, ~25 secciones de panel) | Alta | Medio | Trabajo por fases; cada fase cerrada con pruebas antes de avanzar |

## 3. Dependencias externas

| Dependencia | Necesaria en | Responsable |
|---|---|---|
| Asesoría regulatoria (regente / abogado) sobre venta en línea | Antes de habilitar productos (Fase 4–6) | Negocio |
| Cuentas bancarias de la farmacia | Fase 7 | Negocio |
| Empresas de mensajería y tarifas | Fase 7 | Negocio |
| Cuenta SMTP y dominio de correo | Fase 9 (dev: Mailpit) | Negocio / TI |
| Certificador FEL | Fase posterior | Negocio |
| Servidor, dominio y certificado TLS | Fase 10 | TI |
| Datos de la farmacia, logo, NIT, textos legales | Fase 6 | Negocio |
