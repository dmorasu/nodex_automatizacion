# Nodex Monitor: instalación en el servidor

Panel web en `https://monitor.nodexgpa.com` con la salud del servidor, y avisos de rendimiento y seguridad: **correo para todo, WhatsApp solo para lo urgente**. Corre como el usuario `nodexmon` (sin privilegios), en systemd (no en PM2: si PM2 se cae, el monitor tiene que seguir arriba para avisarlo) y sin dependencias de npm. Código en `Monitor/`, archivos del servidor en esta carpeta.

Todo como root (`sudo -i`), desde `/home/desarrolloti/nodex5.0` ya actualizado con `git pull origin produccion` (como root: como `desarrolloti` git responde "dubious ownership"). `$REPO` se pierde al abrir otra sesión: volver a definirla.

## 1. Usuario y permisos

```bash
useradd --system --home /nonexistent --shell /usr/sbin/nologin nodexmon
usermod -aG adm nodexmon            # leer auth.log y los logs de Nginx
ls -l /var/log/auth.log /var/log/nginx/access.log /var/log/respaldo-nodex.log   # grupo adm (o legibles por todos)
```

Envoltorios de solo lectura (PM2 como `root`, que es su dueño en el servidor: `/root/.pm2`; Postgres como `postgres`):

```bash
REPO=/home/desarrolloti/nodex5.0
RUTA_NODE=$(dirname "$(which pm2)")   # en SRVWEBNOX02: /usr/bin
install -o root -g root -m 755 $REPO/deploy/monitor/nodex-monitor-pm2 /usr/local/bin/
install -o root -g root -m 755 $REPO/deploy/monitor/nodex-monitor-pg /usr/local/bin/
sed -i "s#__RUTA_NODE__#$RUTA_NODE#" /usr/local/bin/nodex-monitor-pm2
install -o root -g root -m 440 $REPO/deploy/monitor/sudoers-nodex-monitor /etc/sudoers.d/nodex-monitor
visudo -cf /etc/sudoers.d/nodex-monitor        # debe decir "parsed OK"; si no, borrar el archivo
sudo -u nodexmon sudo -n -u root /usr/local/bin/nodex-monitor-pm2 | head -c 300; echo   # deben salir nodex-api y los demás
sudo -u nodexmon sudo -n -u postgres /usr/local/bin/nodex-monitor-pg     # ej. 34|100|81|0|0
```

## 2. Código y Node propio

El monitor usa su propio Node (no el de Nodex), para que una actualización de Nodex no lo afecte:

```bash
mkdir -p /opt/nodex-monitor && cd /opt/nodex-monitor
ARCHIVO=$(curl -s https://nodejs.org/dist/latest-v22.x/ | grep -o 'node-v22[0-9.]*-linux-x64.tar.xz' | head -1)
curl -sO https://nodejs.org/dist/latest-v22.x/$ARCHIVO && mkdir node && tar -xJf $ARCHIVO -C node --strip-components=1 && rm $ARCHIVO
node/bin/node -v
rsync -a --delete --exclude node --exclude .env $REPO/Monitor/ /opt/nodex-monitor/
chown -R root:root /opt/nodex-monitor      # nodexmon solo lee: si lo vulneran, no puede cambiarse a sí mismo
```

## 3. Configuración (`/opt/nodex-monitor/.env`)

```bash
cp .env.example .env && chown nodexmon:nodexmon .env && chmod 600 .env
node/bin/node src/clave.js        # pide la contraseña del panel y entrega MONITOR_CLAVE_HASH=...
nano .env
```

- `MONITOR_USUARIO`, `MONITOR_CLAVE_HASH`: acceso al panel.
- `MONITOR_CORREOS` y `MONITOR_WHATSAPP` (`+57...`): a quién avisar.
- `SENDGRID_API_KEY`, `EMAIL_FROM`, `TWILIO_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`: los mismos valores del `.env` del backend.
- `MONITOR_TWILIO_PLANTILLA`: ver el paso 6.
- `MONITOR_IPS_CONOCIDAS`: IPs (o comienzos como `190.85.`) desde las que entras por SSH. Un acceso desde otra IP es **urgente**.
- `MONITOR_PUERTOS_PERMITIDOS`: ver `ss -ltnu` y poner los que deben estar abiertos (22, 80, 443 y los que ya se sabe que el NSG cierra, como 5432). Un puerto nuevo es aviso.
- `REDIS_DB`: el mismo del backend.

## 4. Servicio

```bash
cp $REPO/deploy/monitor/nodex-monitor.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now nodex-monitor
systemctl status nodex-monitor
journalctl -u nodex-monitor -f      # "Panel en http://127.0.0.1:9010" y ningún error de lectura
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:9010/ingresar    # 200
```

Desde el servidor, los dominios propios deben responder (el monitor los revisa por su URL pública): `curl -sI https://tramites.nodexgpa.com | head -1`. Si no responden, usar en `MONITOR_SITIOS` las URL internas (`http://127.0.0.1:9001`, etc.).

## 5. Nginx y HTTPS

1. DNS: registro A `monitor.nodexgpa.com` → `20.186.19.92`.
2. Nginx y certificado:

```bash
cp $REPO/deploy/monitor/nginx-monitor-nodexgpa.conf /etc/nginx/sites-available/nodex-monitor
ln -s /etc/nginx/sites-available/nodex-monitor /etc/nginx/sites-enabled/nodex-monitor
nginx -t && systemctl reload nginx
certbot --nginx -d monitor.nodexgpa.com
```

Para limitar el panel a la IP de la oficina, descomentar `allow` y `deny` en el archivo de Nginx. Pierdes el acceso desde el celular fuera de la oficina; los avisos siguen llegando igual.

## 6. WhatsApp: plantilla en Twilio

WhatsApp solo deja que un negocio inicie una conversación con una **plantilla aprobada**. Sin plantilla, los avisos solo llegan si escribiste al número de Twilio en las últimas 24 horas.

En Twilio: *Messaging → Content Template Builder → Create new*. Tipo *Text*, categoría **Utility**, idioma español, cuerpo:

```
⚠️ Alerta del servidor de Nodex: {{1}}

Revisa el panel en monitor.nodexgpa.com
```

La variable no puede quedar al final del cuerpo (Meta rechaza la plantilla): por eso va la línea del panel.

Cuando Meta la apruebe, copiar su `ContentSid` (`HX...`) en `MONITOR_TWILIO_PLANTILLA` y reiniciar: `systemctl restart nodex-monitor`. Luego, en el panel, **Probar avisos** debe hacer llegar el correo y el WhatsApp.

## Actualizar

```bash
rsync -a --delete --exclude node --exclude .env /home/desarrolloti/nodex5.0/Monitor/ /opt/nodex-monitor/ && chown -R root:root /opt/nodex-monitor && chown nodexmon:nodexmon /opt/nodex-monitor/.env
systemctl restart nodex-monitor
```

Si cambian los envoltorios o el sudoers, repetir el paso 1. Las alertas activas y las 24 h de historia quedan en `/var/lib/nodex-monitor/estado.json`.

## Qué avisa

| Urgente (WhatsApp + correo) | Aviso (correo) |
|---|---|
| CPU ≥ 90 % durante 15 min (un `npm run build` no alcanza) | RAM disponible ≤ 1,5 GB · swap ≥ 200 MB |
| RAM disponible ≤ 800 MB · swap ≥ 1 GB · disco ≥ 90 % | Disco ≥ 80 % |
| Proceso de PM2 caído, que desaparece o que se reinicia 3 veces en 15 min | Sitio lento (> 5 s) · certificado a ≤ 14 días |
| Postgres o Redis no responden · un sitio no responde | Postgres ≥ 80 % de conexiones, consultas de > 5 min, bloqueos |
| Certificado a ≤ 3 días | Cola con ≥ 200 trabajos en espera o ≥ 20 fallidos en 1 h |
| Una IP con ≥ 3000 peticiones/min | Una IP con ≥ 600 peticiones/min · ≥ 20 errores 5xx en 5 min |
| Acceso SSH desde una IP que no está en `MONITOR_IPS_CONOCIDAS` | ≥ 50 intentos SSH fallidos en 10 min · sudo con clave errada |
| Usuario del sistema nuevo, alguien que entra al grupo sudo/adm, cambio de contraseña | ≥ 20 logins fallidos de Nodex en 10 min · ≥ 5 claves erradas en el monitor |
| | Puerto abierto que no está permitido · respaldo incompleto o de hace más de 26 h · el monitor no puede leer PM2 o los logs |

Las alertas que duran se avisan al empezar y al resolverse. Lo urgente se repite cada 2 h mientras siga (`MONITOR_REPETIR_URGENTE_MIN`), con un máximo de 6 WhatsApp por hora (`MONITOR_MAX_WHATSAPP_HORA`). Los umbrales se cambian en `.env` (ver `Monitor/src/config.js`).

**Límite:** si se apaga la VM completa, el monitor se apaga con ella y no puede avisar. Para cubrir ese caso hace falta un chequeo externo, por ejemplo una alerta de Azure Monitor sobre la VM o un servicio de disponibilidad que revise `https://tramites.nodexgpa.com`.
