#!/bin/sh
# Restaura un respaldo: ./restore.sh /backups/daily/2026-11-01_0200
# Reemplaza TODA la base y los archivos cargados. Detener backend y frontend antes.
set -eu
src=${1:?Indique la carpeta del respaldo}
( cd "$src" && sha256sum -c SHA256SUMS )
pg_restore --clean --if-exists --no-owner --single-transaction --dbname="$DATABASE_URL" "$src/farmacia.dump"
rm -rf /data/uploads/*
tar -xzf "$src/uploads.tar.gz" -C /data
echo "Restaurado desde $src"
