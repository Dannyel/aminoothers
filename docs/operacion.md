# Operación

Tareas del día a día del servidor de producción. Los comandos se ejecutan en la carpeta del proyecto en el VPS. Abreviatura usada:

```bash
alias dc='docker compose -f docker-compose.prod.yml --env-file .env.production'
```

## Procesos en segundo plano (dentro de la API)

| Proceso | Frecuencia | Qué hace |
|---|---|---|
| Vencimiento de reservas | `RESERVATION_SWEEP_INTERVAL_SECONDS` (5 min) | Libera las reservas de pedidos no pagados o no confirmados a tiempo (D3) |
| Bandeja de correos | `NOTIFICATION_DISPATCH_INTERVAL_SECONDS` (30 s) | Envía los correos pendientes; hasta 5 intentos con espera de 1, 5, 15 y 60 min |
| Resumen de inventario | Una vez al día desde `INVENTORY_DIGEST_HOUR` (7 h) | Alertas de vencimiento y existencias al correo del personal |
| Retención (D20) | Cada hora | Borra lo que superó su plazo (tabla abajo) |

Todos usan candados de PostgreSQL: si algún día hay más de una instancia de la API, no se duplican.

## Retención de datos (D20)

| Datos | Se conservan | Detalle |
|---|---|---|
| Auditoría | 5 años | Un trigger impide modificarla y borrar registros más recientes, incluso a mano |
| Correos enviados | 180 días desde el envío | Los pendientes y los fallidos no se borran |
| Sesiones vencidas o revocadas | 30 días | Para investigar incidentes |
| Enlaces de un solo uso y desafíos de doble factor | 7 días después de vencer o usarse | |
| Pedidos, pagos, comprobantes, inventario | Sin borrado automático | Son registros comerciales y tributarios |
| Respaldos | 14 diarios y 12 mensuales | Configurables con `BACKUP_KEEP_*` |

## Respaldos

El servicio `backup` genera cada día, a las `BACKUP_HOUR` (2 h, hora de Guatemala), una carpeta en `BACKUP_PATH/daily/AAAA-MM-DD_HHMM/` con:

- `farmacia.dump`: la base completa (`pg_dump`, formato personalizado);
- `uploads.tar.gz`: imágenes, logotipo y comprobantes de pago;
- `SHA256SUMS`: sumas de verificación de los dos archivos.

La copia del día 1 de cada mes se guarda también en `monthly/`.

**Copia fuera del servidor (obligatoria).** Un respaldo en el mismo VPS no protege contra la pérdida del servidor. Sincronizar `BACKUP_PATH` a otro lugar a diario, por ejemplo con `rclone` o `restic` hacia un almacenamiento de objetos o `rsync` a otro servidor. Los respaldos contienen datos personales y comprobantes de pago: el destino debe estar cifrado y con acceso restringido.

### Respaldo manual

```bash
dc exec backup /scripts/backup.sh now
ls backups/daily/
```

### Restaurar

Reemplaza **toda** la base y los archivos por los del respaldo elegido.

```bash
dc stop caddy frontend backend
dc --profile restore run --rm restore /backups/daily/2026-11-01_0200
dc up -d
```

El script verifica las sumas antes de restaurar y aplica la base en una sola transacción: si algo falla, la base queda como estaba. Después de restaurar, `migrate` vuelve a correr al hacer `up` y aplica las migraciones que falten si el respaldo es de una versión anterior.

**Probar la restauración cada trimestre** en un servidor aparte. Un respaldo que nunca se restauró no está probado.

## Monitoreo

| Qué vigilar | Cómo |
|---|---|
| Disponibilidad | `GET https://DOMINIO/health` desde un servicio externo, cada minuto |
| Estado de los contenedores | `dc ps`: todos `healthy`, y `migrate` en `exited (0)` |
| Errores | `dc logs --since=1h backend \| grep -i error` |
| Correos fallidos | Panel → Dashboard (sección Correos) o Configuración → Correos enviados |
| Alertas de inventario | Resumen diario en el correo del personal y en el dashboard |
| Respaldos | `ls -lt backups/daily \| head`: debe haber una carpeta de hoy |
| Disco | `df -h` y `docker system df`; los registros de Docker rotan con la configuración del daemon |

Rotación de los registros de Docker, en `/etc/docker/daemon.json`:

```json
{ "log-driver": "json-file", "log-opts": { "max-size": "20m", "max-file": "5" } }
```

## Tareas frecuentes

| Tarea | Cómo |
|---|---|
| Un usuario perdió su app autenticadora | Panel → Usuarios (o Clientes) → «Restablecer doble factor». Queda en la auditoría |
| Un usuario quedó bloqueado por intentos fallidos | Se desbloquea solo tras `AUTH_LOCK_MINUTES` (15 min) o con «Recuperar contraseña» |
| Un correo no llegó | Panel → Correos enviados: ver el estado y el último error; reintentar si falló |
| Revisar quién cambió un precio | Panel → Auditoría → módulo Productos; el detalle muestra el valor anterior y el nuevo |
| Cambiar de proveedor SMTP | Editar `SMTP_*` en `.env.production` y `dc up -d backend` |

## Incidentes de seguridad

1. **Contener.** Bloquear las cuentas comprometidas desde el panel; eso revoca sus sesiones al instante.
2. **Si se filtró `JWT_ACCESS_SECRET`:** cambiarlo y reiniciar la API. Los tokens de acceso firmados con el anterior dejan de valer en ese momento; las sesiones se renuevan con su refresh token.
3. **Si se filtró `TOTP_ENCRYPTION_KEY`:** cambiarla obliga a todos a configurar de nuevo el doble factor. Hay que restablecer el doble factor de cada usuario antes del cambio.
4. **Investigar** con la auditoría (usuario, IP y fecha de cada operación del panel, inicios de sesión fallidos) y las sesiones.
5. **Registrar** el incidente y, si hubo datos personales expuestos, notificar a los afectados.
