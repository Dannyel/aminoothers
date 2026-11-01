#!/bin/sh
# Respaldo diario de PostgreSQL y de los archivos cargados (D17, D20).
# Corre en un contenedor postgres:18 con acceso de lectura al volumen de
# archivos. Conserva BACKUP_KEEP_DAILY copias diarias y BACKUP_KEEP_MONTHLY
# mensuales (la del día 1 de cada mes). Hora de ejecución: BACKUP_HOUR (UTC−6).
set -eu

BACKUP_DIR=${BACKUP_DIR:-/backups}
KEEP_DAILY=${BACKUP_KEEP_DAILY:-14}
KEEP_MONTHLY=${BACKUP_KEEP_MONTHLY:-12}
HOUR=${BACKUP_HOUR:-2}
export TZ=America/Guatemala

mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/monthly"

backup() {
  stamp=$(date +%Y-%m-%d_%H%M)
  tmp="$BACKUP_DIR/.tmp-$stamp"
  mkdir -p "$tmp"
  # Formato personalizado: comprimido y restaurable tabla por tabla.
  pg_dump --format=custom --no-owner --file="$tmp/farmacia.dump" "$DATABASE_URL"
  tar -czf "$tmp/uploads.tar.gz" -C /data uploads
  ( cd "$tmp" && sha256sum farmacia.dump uploads.tar.gz > SHA256SUMS )
  mv "$tmp" "$BACKUP_DIR/daily/$stamp"
  if [ "$(date +%d)" = "01" ]; then
    cp -r "$BACKUP_DIR/daily/$stamp" "$BACKUP_DIR/monthly/$stamp"
  fi
  # Rotación: se borran las copias más antiguas que excedan lo conservado.
  ls -1d "$BACKUP_DIR"/daily/*/ | sort | head -n "-$KEEP_DAILY" | xargs -r rm -rf
  ls -1d "$BACKUP_DIR"/monthly/*/ 2>/dev/null | sort | head -n "-$KEEP_MONTHLY" | xargs -r rm -rf
  echo "$(date -Iseconds) respaldo $stamp completo"
}

if [ "${1:-}" = "now" ]; then
  backup
  exit 0
fi

echo "Respaldos diarios a las ${HOUR}:00 (Guatemala) en $BACKUP_DIR"
last=""
while true; do
  today=$(date +%F)
  if [ "$(date +%H)" -ge "$HOUR" ] && [ "$last" != "$today" ]; then
    if backup; then last=$today; else echo "$(date -Iseconds) ERROR en el respaldo" >&2; fi
  fi
  sleep 300
done
