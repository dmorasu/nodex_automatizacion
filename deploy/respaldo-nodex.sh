#!/bin/bash
# Respaldo diario a Azure Blob Storage (contenedor respaldos-nodex de la cuenta filegpa02):
#   · todas las bases de Postgres (menos las plantillas) · usuarios y permisos · código de Nodex
# En el servidor solo queda el archivo mientras se sube. Azure borra los de más de 30 días.
#
# Instalación en el servidor (como root):
#   cp deploy/respaldo-nodex.sh /usr/local/bin/respaldo-nodex.sh && chmod 700 /usr/local/bin/respaldo-nodex.sh
#   /root/.respaldo-nodex.env (chmod 600) con una línea:
#     DESTINO_AZURE="https://filegpa02.blob.core.windows.net/respaldos-nodex?sv=..."   (URL de SAS de blob)
#   echo "30 2 * * * root /usr/local/bin/respaldo-nodex.sh >> /var/log/respaldo-nodex.log 2>&1" > /etc/cron.d/respaldo-nodex
# Requiere AzCopy en /usr/local/bin/azcopy. Detalles en RESUMEN_TECNICO_NODEX.md ("Servidor: mantenimiento y respaldos").
set -uo pipefail
cd /tmp   # postgres no puede entrar a /root ni a /home/desarrolloti
source /root/.respaldo-nodex.env
export AZCOPY_LOG_LOCATION=/tmp/azcopy-logs AZCOPY_JOB_PLAN_LOCATION=/tmp/azcopy-planes
TEMPORAL=$(mktemp -d /tmp/respaldo-nodex.XXXX)
trap 'rm -rf "$TEMPORAL" /tmp/azcopy-logs /tmp/azcopy-planes' EXIT
FECHA=$(date +%Y%m%d_%H%M)
CARPETA=$(date +%Y/%m)
FALLAS=()

subir() {   # subir <archivo> <carpeta en Azure>
  azcopy copy "$1" "${DESTINO_AZURE%%\?*}/$2/$CARPETA/$(basename "$1")?${DESTINO_AZURE#*\?}" \
    --overwrite=false --log-level=ERROR --output-level=quiet
}

# 1) Cada base de datos (las plantillas y "postgres" no tienen datos de las apps)
BASES=$(sudo -u postgres psql -Atc "SELECT datname FROM pg_database WHERE NOT datistemplate AND datname <> 'postgres' ORDER BY 1")
for BD in $BASES; do
  ARCHIVO="$TEMPORAL/${BD}_${FECHA}.dump"
  if sudo -u postgres pg_dump -Fc "$BD" > "$ARCHIVO" && pg_restore -l "$ARCHIVO" > /dev/null && subir "$ARCHIVO" "$BD"; then
    echo "$(date '+%F %T') OK $BD $(du -h "$ARCHIVO" | cut -f1)"
  else
    echo "$(date '+%F %T') FALLÓ $BD"; FALLAS+=("$BD")
  fi
  rm -f "$ARCHIVO"
done

# 2) Usuarios y permisos de Postgres (necesarios para restaurar en un servidor nuevo)
ARCHIVO="$TEMPORAL/postgres_usuarios_${FECHA}.sql"
if sudo -u postgres pg_dumpall --globals-only > "$ARCHIVO" && subir "$ARCHIVO" "postgres_usuarios"; then
  echo "$(date '+%F %T') OK usuarios de postgres"
else
  echo "$(date '+%F %T') FALLÓ usuarios de postgres"; FALLAS+=("usuarios")
fi

# 3) Código de Nodex: el repositorio completo (todas las ramas e historial) en un archivo.
#    "bundle verify" se ejecuta dentro del repositorio: fuera de él git lo rechaza.
REPO=/home/desarrolloti/nodex5.0
if [ -d "$REPO/.git" ]; then
  ARCHIVO="$TEMPORAL/nodex_codigo_${FECHA}.bundle"
  if git -c safe.directory='*' -C "$REPO" bundle create "$ARCHIVO" --all 2>/dev/null \
     && git -c safe.directory='*' -C "$REPO" bundle verify "$ARCHIVO" > /dev/null 2>&1 && subir "$ARCHIVO" "codigo"; then
    echo "$(date '+%F %T') OK codigo $(du -h "$ARCHIVO" | cut -f1)"
  else
    echo "$(date '+%F %T') FALLÓ codigo"; FALLAS+=("codigo")
  fi
fi

if [ ${#FALLAS[@]} -gt 0 ]; then
  echo "$(date '+%F %T') ⚠️ RESPALDO INCOMPLETO: ${FALLAS[*]}"; exit 1
fi
echo "$(date '+%F %T') ✅ Respaldo completo"
