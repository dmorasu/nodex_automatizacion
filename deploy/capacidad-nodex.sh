#!/bin/bash
# Medición del uso del servidor, para decidir con datos cuándo crecer la VM o separar la base.
#   capacidad-nodex.sh            → agrega una medición a /var/log/capacidad-nodex.tsv (lo llama el cron)
#   capacidad-nodex.sh resumen    → un renglón por día con los picos y avisos según los umbrales
#   capacidad-nodex.sh resumen 30 → igual, de los últimos 30 días (por defecto 14)
# Se mide cada 15 minutos en horario de oficina porque lo que importa son los picos, no el promedio del día.
#
# Instalación en el servidor (como root):
#   cp deploy/capacidad-nodex.sh /usr/local/bin/capacidad-nodex.sh && chmod 700 /usr/local/bin/capacidad-nodex.sh
#   echo "*/15 7-19 * * 1-6 root /usr/local/bin/capacidad-nodex.sh" > /etc/cron.d/capacidad-nodex
# Detalles en RESUMEN_TECNICO_NODEX.md ("Servidor: mantenimiento y respaldos").
set -uo pipefail
cd /tmp   # postgres no puede entrar a /root
LOG=/var/log/capacidad-nodex.tsv
BASE=nodex

# Umbrales de la tabla del resumen técnico: pasarlos seguido es la señal para crecer o separar
UMBRAL_CPU=70        # % de CPU ocupada
UMBRAL_RAM_MB=1500   # RAM disponible mínima
UMBRAL_SWAP_MB=200   # swap en uso: el servidor ya se quedó corto de RAM
UMBRAL_DISCO=80      # % del disco
UMBRAL_BASE_MB=5000  # tamaño de la base de Nodex

if [ "${1:-}" = "resumen" ]; then
  DIAS=${2:-14}
  DESDE=$(date -d "-$DIAS days" +%F)
  { echo -e "fecha\tCPU máx %\tRAM disp. mín MB\tswap máx MB\tdisco %\tbase MB\tconex. Postgres máx\tconex. HTTPS máx\tavisos"
  awk -F'\t' -v desde="$DESDE" -v ucpu=$UMBRAL_CPU -v uram=$UMBRAL_RAM_MB -v uswap=$UMBRAL_SWAP_MB \
      -v udisco=$UMBRAL_DISCO -v ubase=$UMBRAL_BASE_MB '
    NR > 1 && substr($1, 1, 10) >= desde {
      d = substr($1, 1, 10)
      if (!(d in cpu)) { orden[++n] = d; ram[d] = $3 }
      if ($2 > cpu[d]) cpu[d] = $2
      if ($3 < ram[d]) ram[d] = $3
      if ($4 > swap[d]) swap[d] = $4
      disco[d] = $5; base[d] = $6
      if ($7 > pg[d]) pg[d] = $7
      if ($8 > https[d]) https[d] = $8
    }
    END {
      for (i = 1; i <= n; i++) {
        d = orden[i]; aviso = ""
        if (cpu[d] >= ucpu) aviso = aviso " CPU"
        if (ram[d] <= uram) aviso = aviso " RAM"
        if (swap[d] >= uswap) aviso = aviso " swap"
        if (disco[d] >= udisco) aviso = aviso " disco"
        if (base[d] >= ubase) aviso = aviso " base"
        printf "%s\t%d\t%d\t%d\t%d\t%d\t%d\t%d\t%s\n", d, cpu[d], ram[d], swap[d], disco[d], base[d], pg[d], https[d], (aviso == "" ? "—" : aviso)
      }
    }' "$LOG"; } | column -t -s $'\t'
  exit 0
fi

[ -f "$LOG" ] || echo -e "fecha\tcpu_pct\tram_disponible_mb\tswap_usada_mb\tdisco_pct\tbase_mb\tconexiones_postgres\tconexiones_https" > "$LOG"

# CPU ocupada durante 5 segundos (100 - inactiva); la columna 15 de vmstat es "id"
CPU=$(vmstat 5 2 | tail -1 | awk '{print 100 - $15}')
RAM=$(free -m | awk '/^Mem:/ {print $7}')
SWAP=$(free -m | awk '/^Swap:/ {print $3}')
DISCO=$(df --output=pcent / | tail -1 | tr -dc '0-9')
BASE_MB=$(sudo -u postgres psql -Atc "SELECT pg_database_size('$BASE') / 1048576" 2>/dev/null || echo 0)
PG=$(sudo -u postgres psql -Atc "SELECT count(*) FROM pg_stat_activity WHERE datname IS NOT NULL" 2>/dev/null || echo 0)
# Conexiones abiertas al 443: cada navegador abre varias, así que usuarios a la vez ≈ conexiones / 3.
# No se cuentan IPs distintas porque toda la oficina sale a internet con la misma IP.
HTTPS=$(ss -Htn state established '( sport = :443 )' | wc -l)

echo -e "$(date '+%F %H:%M')\t$CPU\t$RAM\t$SWAP\t$DISCO\t$BASE_MB\t$PG\t$HTTPS" >> "$LOG"
