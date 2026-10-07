# Paso a producción de Nodex (del ensayo a la base real)

El ensayo (`/home/desarrolloti/nodex5.0`, procesos `nodex-ensayo-*`, puertos 9000–9003, dominios
`*.nodexgpa.com`) ya está instalado, compilado y probado contra `nodex_pruebas`. Pasar a producción es
**apuntarlo a la base real (`nodex`), quitar el modo ensayo y apagar la versión 4.5**. No se vuelve a
instalar ni a compilar.

Servidor `SRVWEBNOX02` · todo como `root` · la 4.5 son los procesos `apiNodex4.5`, `Nodex4.5` y
`worker4.5`. **Vehículos, Inmuebles y `nodex_ga4.0` no se tocan.**

---

## Antes del día del cambio

1. **Hora:** fuera de horario laboral y lejos de las 08:00 y 13:00 (la 4.5 envía WhatsApp automáticos a
   esas horas). Calcular 45–60 minutos.
2. **Avisar a los usuarios:** nueva dirección https://tramites.nodexgpa.com (y gastos / tramitadores),
   mismo usuario y contraseña, y la ventana sin servicio.
3. **Lista de perfiles:** en la base nueva nadie tiene perfil hasta que se le asigne, y sin perfil nadie
   entra. Se reutilizan los asignados en el ensayo (paso 2) y lo que falte se asigna en Administración.
4. **`API_KEY_EXTERNA` definitiva** (en el servidor; no reutilizar la de desarrollo):
   ```bash
   echo "API_KEY_EXTERNA=$(openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-43)"
   ```
5. **Lista de lo configurado en las pantallas del ensayo** que se quiera conservar (ver "Qué se repite
   y qué no" al final).

---

## El día del cambio

### 1. Respaldo completo de producción (obligatorio: es el plan B)
```bash
cd /tmp; FECHA=$(date +%Y%m%d_%H%M)
sudo -u postgres pg_dump -Fc nodex > /var/backups/nodex/nodex_ANTES_DEL_CAMBIO_$FECHA.dump
ls -lh /var/backups/nodex/
```

### 2. Guardar los perfiles del ensayo
Los ids de usuario son los mismos (el ensayo es copia de producción):
```bash
sudo -u postgres psql -d nodex_pruebas -At -c "SELECT format('INSERT INTO gastos_usuario_roles (usuario_id, rol_id, created_at, updated_at) SELECT %s, id, NOW(), NOW() FROM gastos_roles WHERE codigo = %L ON CONFLICT (usuario_id, rol_id) DO NOTHING;', ur.usuario_id, r.codigo) FROM gastos_usuario_roles ur JOIN gastos_roles r ON r.id = ur.rol_id;" > /var/backups/nodex/perfiles.sql
wc -l /var/backups/nodex/perfiles.sql
```

### 3. Apagar la 4.5
Primero la API (no entran trabajos nuevos) y un minuto después el worker (termina los pendientes):
```bash
pm2 stop apiNodex4.5 Nodex4.5
sleep 60
pm2 stop worker4.5
```

### 4. Revisar los analistas en `nodex`
Al primer arranque se asignan **una sola vez** por el texto de `responsable`
(`'Maria Orlinda' → 24`, `'Jenny Velosa' → 45`, `'Johan Diaz' → 55`). Deben salir esos tres nombres exactos:
```bash
sudo -u postgres psql -d nodex -c "SELECT TRIM(responsable), COUNT(*) FROM \"Municipios\" GROUP BY 1 ORDER BY 2 DESC;"
```
Si alguno cambió, corregirlo antes del paso 6 (ver la guía de ensayo, paso 3.1).

### 5. `.env` del backend a producción
```bash
cd /home/desarrolloti/nodex5.0/Backend
cp .env .env.ensayo                                   # guardar la versión del ensayo
poner(){ if grep -q "^$1=" "$3"; then sed -i "s|^$1=.*|$1=$2|" "$3"; else echo "$1=$2" >> "$3"; fi; }
poner DB_NAME nodex .env
poner MODO_ENSAYO no .env
sed -i '/^CORREO_ENSAYO=/d' .env
# Mismo recurso compartido de Azure que la 4.5 (para que abran los documentos de siempre)
poner AZURE_FILE_SHARE_NAME "$(grep '^AZURE_FILE_SHARE_NAME=' /home/desarrolloti/nodex4.0/nodex_automatizacion/Backend/.env | cut -d= -f2-)" .env
nano .env    # pegar la API_KEY_EXTERNA definitiva
grep -E "^(DB_NAME|MODO_ENSAYO|AZURE_FILE_SHARE_NAME|REDIS_DB|PORT)=" .env
```
Debe quedar: `DB_NAME=nodex`, `MODO_ENSAYO=no`, el recurso compartido de producción, `REDIS_DB=1`
(la base 0 queda con lo de la 4.5) y `PORT=9000`.
**No cambiar `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`:** las suscripciones push del ensayo quedan en
`nodex_pruebas`, pero con las mismas claves cada celular se vuelve a registrar solo la próxima vez que
el tramitador abre el inicio de la app (si ya había dado el permiso).

### 6. Reiniciar backend y worker contra la base real
El primer arranque crea columnas y tablas nuevas en `nodex`, asigna los analistas y crea roles,
catálogos de Gastos y notificaciones automáticas:
```bash
pm2 restart nodex-ensayo-api nodex-ensayo-worker --update-env
sleep 20; pm2 logs nodex-ensayo-api --lines 30 --nostream | grep -v "dotenv@"
```
Debe salir **`Conexion Exitosa`** y **no** debe salir "MODO ENSAYO". Si sale "Fallo la Conexion…", ir al plan B.

### 7. Perfiles
```bash
# Primero quien administra
sudo -u postgres psql -d nodex -c "INSERT INTO gastos_usuario_roles (usuario_id, rol_id, created_at, updated_at) SELECT u.id, r.id, NOW(), NOW() FROM \"Usuarios\" u JOIN gastos_roles r ON r.codigo='ADMIN' WHERE LOWER(u.\"correoUsuario\")='dmorasu@gmail.com' ON CONFLICT (usuario_id, rol_id) DO NOTHING;"
# Luego los del ensayo
sudo -u postgres psql -d nodex -f /var/backups/nodex/perfiles.sql
sudo -u postgres psql -d nodex -c "SELECT r.codigo, COUNT(*) FROM gastos_usuario_roles ur JOIN gastos_roles r ON r.id=ur.rol_id GROUP BY 1;"
```
Los que falten: Nodex Trámites → Administración.

### 8. Scripts de datos (primero sin aplicar, revisar, luego aplicar)
```bash
cd /home/desarrolloti/nodex5.0/Backend
node dist/scripts/sincronizarEstadoActual.js | grep -v "dotenv@"
node dist/scripts/sincronizarEstadoActual.js --aplicar | grep -v "dotenv@"
node dist/scripts/corregirMensajesWhatsapp.js | grep -v "dotenv@" | tail -5
node dist/scripts/corregirMensajesWhatsapp.js --aplicar | grep -v "dotenv@" | tail -5
```

### 9. La dirección vieja (IP) lleva a la nueva
```bash
cp /etc/nginx/sites-available/app /var/backups/nodex/nginx-app-4.5.conf
cat > /etc/nginx/sites-available/app <<'EOF'
server {
    listen 80 default_server;
    server_name _;
    return 301 https://tramites.nodexgpa.com$request_uri;
}
EOF
nginx -t && systemctl reload nginx
```

### 10. Comprobar y guardar
- Entrar a las 3 apps con usuarios de distintos perfiles.
- Abrir un trámite viejo con documentos: deben abrir (recurso de Azure de producción).
- Los correos ya **no** deben decir `[ENSAYO]`.
- Repetir lo configurado en el ensayo que se quiera conservar (ver abajo).
- Si todo está bien: `pm2 save`

---

## Plan B (si algo sale mal)

```bash
pm2 stop nodex-ensayo-api nodex-ensayo-worker nodex-ensayo-tramites nodex-ensayo-gastos nodex-ensayo-tramitadores
cp /var/backups/nodex/nginx-app-4.5.conf /etc/nginx/sites-available/app && nginx -t && systemctl reload nginx
pm2 start apiNodex4.5 Nodex4.5 worker4.5
```
Los cambios de la versión nueva en la base solo **agregan** columnas y tablas, así que la 4.5 debería
seguir funcionando. Si no, restaurar el respaldo del paso 1 sobre `nodex` (se pierde lo registrado
después del cambio):
```bash
sudo -u postgres dropdb nodex
sudo -u postgres createdb -O desarrolloti nodex
sudo -u postgres pg_restore -d nodex --no-owner --role=desarrolloti /var/backups/nodex/nodex_ANTES_DEL_CAMBIO_<FECHA>.dump
```

---

## Qué se repite y qué no

**Lo hace solo el backend al primer arranque contra `nodex` (paso 6):**
columnas y tablas nuevas, asignación de analistas a municipios y trámites (por `responsable`), roles,
catálogos de Gastos y las 2 notificaciones automáticas con sus horarios por defecto.

**Se repite a mano (pasos 7 y 8):**

| Qué | Paso |
|---|---|
| Rol ADMIN de quien administra | 7 |
| Perfiles de los usuarios (`perfiles.sql` del ensayo) | 2 y 7 |
| Sincronizar el estado actual de los trámites | 8 |
| Corregir el texto de los WhatsApp guardados | 8 |

**Configurado en las pantallas del ensayo: NO pasa solo** (vive en `nodex_pruebas`). Si se quiere en
producción, repetirlo desde las pantallas después del paso 8:
- Reasignaciones manuales de analistas (municipios o trámites).
- Catálogos: tipos de trámite, subestados, operaciones, tipos de rechazo y tramitadores creados o editados.
- Rutas: sedes de mensajería y tramitadores marcados como mensajeros con su sede.
- Accesos a la app de tramitadores (usuario y contraseña temporal).
- Horarios o días de las notificaciones automáticas.
- Nodex Gastos: bolsas, beneficiarios, cuentas y demás configuración.

Los datos de prueba del ensayo (gastos, pagos, trámites de prueba) **no** deben pasar y no pasan.
Si lo configurado es mucho, se puede exportar de `nodex_pruebas` e importar en `nodex` por SQL, tabla
por tabla, con cuidado (producción sigue recibiendo datos).

---

## Después del cambio

- Dejar los procesos 4.5 **detenidos, sin borrar**, una semana. Si todo va bien:
  `pm2 delete apiNodex4.5 Nodex4.5 worker4.5 && pm2 save`.
- Desde ese momento salen **WhatsApp y correos reales**; las notificaciones automáticas a las 08:00 y
  13:00 (o lo configurado en Notificaciones automáticas).
- `nodex5.0` pasa a ser producción y ya no hay ensayo. Para tener uno de nuevo: otra carpeta, la base
  `nodex_pruebas`, otros puertos y otros subdominios.
- Los procesos se siguen llamando `nodex-ensayo-*` en PM2; funciona igual (se pueden renombrar después).
- Si se conoce la IP de la plataforma que consume `/api/externa`, dejar solo esa en
  `/etc/nginx/sites-available/nodexgpa` (`allow IP; deny all;`) y recargar Nginx.
