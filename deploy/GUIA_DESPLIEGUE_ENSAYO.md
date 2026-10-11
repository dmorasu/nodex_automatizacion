# Despliegue de ensayo de Nodex en nodexgpa.com

Servidor Ubuntu `SRVWEBNOX02` (IP pública `20.186.19.92`, privada `10.0.4.4`) con PM2, donde ya corre la producción actual
(`/home/desarrolloti/nodex4.0`, procesos `apiNodex4.5`, `Nodex4.5` y `worker4.5`, puertos 4000 y 3000, base `nodex`)
y otras apps (Vehículos, Inmuebles: puertos 3001, 3002, 5000, 5001, 6001). Nada de eso se toca.
El ensayo usa la base **`nodex_pruebas`** (copia de producción), **otra base de Redis** (la 1) y los puertos **9000–9003**,
desde la carpeta **`/home/desarrolloti/nodex5.0`**.

| App | Puerto (solo 127.0.0.1) | Dirección pública |
|---|---|---|
| API (backend) | 9000 | https://api.nodexgpa.com (solo `/api/externa`; lo demás da 404: las apps la llaman por dentro) |
| Nodex Trámites | 9001 | https://tramites.nodexgpa.com |
| Nodex Gastos | 9002 | https://gastos.nodexgpa.com |
| Nodex Tramitadores | 9003 | https://tramitadores.nodexgpa.com |
| Worker de notificaciones | — | — |

> **Modo ensayo (`MODO_ENSAYO=si`)**: la base es una copia con teléfonos y correos reales. Con este modo
> no se programan los WhatsApp automáticos, ningún WhatsApp sale a Twilio y todos los correos llegan
> solo a `CORREO_ENSAYO`. **Quitarlo solo cuando el ensayo pase a ser la producción.**

---

## 1. Revisar el servidor (5 min)

```bash
node -v                      # Next 14 pide 18.17 o más (recomendado 20 o 22)
pm2 list                     # procesos de producción: anotar los nombres para no tocarlos
sudo ss -tlnp | grep -E ':(80|443|3000|4000|900[0-3]|5432|6379)\b'
redis-cli ping               # PONG
psql --version
```
- Los puertos 9000–9003 deben estar **libres**.
- Si algo ya usa el 80 o el 443 (Apache, otro Nginx), avisar antes de seguir.

## 2. DNS del dominio (hacerlo primero: tarda en propagar)

En el proveedor de nodexgpa.com, crear 4 registros **A** a la **IP pública del servidor**:

| Nombre | Tipo | Valor |
|---|---|---|
| tramites | A | IP del servidor |
| gastos | A | IP del servidor |
| tramitadores | A | IP del servidor |
| api | A | IP del servidor |

Comprobar (debe responder la IP):
```bash
dig +short tramites.nodexgpa.com
```
En Azure: la VM con **IP pública estática** y el grupo de seguridad (NSG) con entrada **80 y 443** abiertos.
**No** abrir 9000–9003.

## 3. Base de datos de ensayo (copia de producción)

Postgres corre en este mismo servidor (IP privada `10.0.4.4`). Producción usa la base `nodex`;
el ensayo usa **`nodex_pruebas`**, recreada como copia de `nodex` y a nombre de `desarrolloti`
(así el backend puede hacer los `ALTER TABLE` de los ajustes de esquema al arrancar).
Hecho el 2026-10-06. Para volver a refrescarla (cerrar antes cualquier pgAdmin conectado):

```bash
cd /tmp && FECHA=$(date +%Y%m%d)
sudo -u postgres pg_dump -Fc nodex_pruebas > /tmp/nodex_pruebas_respaldo_$FECHA.dump   # respaldo
sudo -u postgres pg_dump -Fc nodex > /tmp/nodex_prod_$FECHA.dump                      # solo lee producción
sudo -u postgres dropdb nodex_pruebas
sudo -u postgres createdb -O desarrolloti nodex_pruebas
sudo -u postgres pg_restore -d nodex_pruebas --no-owner --role=desarrolloti /tmp/nodex_prod_$FECHA.dump
sudo mkdir -p /var/backups/nodex && sudo mv /tmp/nodex_*_$FECHA.dump /var/backups/nodex/
```

### 3.1 Asignación de analistas (ANTES del primer arranque)

Al primer arranque, `ajustesEsquemaTramites.ts` crea `Municipios.analistaId` y lo llena **una sola vez**
con: `'Maria Orlinda' → 24`, `'Jenny Velosa' → 45`, `'Johan Diaz' → 55`. Revisar en la copia:

```bash
sudo -u postgres psql -d nodex_pruebas
```
```sql
-- 1) Los ids deben ser de esas tres personas
SELECT id, "nombreUsuario", "correoUsuario" FROM "Usuarios" WHERE id IN (24, 45, 55);

-- 2) El texto de responsable debe coincidir EXACTO (se ignoran espacios al inicio y al final)
SELECT TRIM(responsable) AS responsable, COUNT(*) FROM "Municipios" GROUP BY 1 ORDER BY 2 DESC;
```
Si un nombre aparece distinto (tilde, mayúsculas, otro apellido), corregirlo **antes** de arrancar:
```sql
UPDATE "Municipios" SET responsable = 'Maria Orlinda' WHERE TRIM(responsable) = 'María Orlinda';
UPDATE "Municipios" SET responsable = 'Johan Diaz'    WHERE TRIM(responsable) = 'Johan Díaz';
```
Los municipios con otro responsable (o vacío) quedan sin analista y se asignan después en
Nodex Trámites → Asignación de analistas.

## 4. Código

```bash
# La carpeta ya existe y es de desarrolloti (debe estar vacía para clonar)
git clone -b desarrollo https://github.com/dmorasu/nodex_automatizacion.git /home/desarrolloti/nodex5.0
cd /home/desarrolloti/nodex5.0
```
> El repositorio ya no trae `node_modules` (se sacaron el 2026-10-06): `npm ci` las instala en el paso 6.

## 5. Variables de entorno

### 5.1 `Backend/.env`
```ini
PORT=9000
HOST=127.0.0.1
NODE_ENV=production
JWT_SECRET=<uno NUEVO, distinto al de producción>

# Base de ensayo
DB_HOST=10.0.4.4
DB_PORT=5432
DB_NAME=nodex_pruebas
DB_USER=desarrolloti
DB_PASSWORD=<la del usuario>

# Redis: producción usa la base 0; el ensayo la 1 (cada worker solo ve sus trabajos)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=1

# MODO ENSAYO: sin WhatsApp reales y todos los correos a CORREO_ENSAYO
MODO_ENSAYO=si
CORREO_ENSAYO=dmora@gomezpinedaabogados.com

# Azure: usar un recurso compartido APARTE para no tocar los archivos de producción
# (los documentos viejos no abrirán en el ensayo; los nuevos sí)
AZURE_STORAGE_CONNECTION_STRING=<la misma>
AZURE_FILE_SHARE_NAME=nodex-ensayo

SENDGRID_API_KEY=<la misma>
EMAIL_FROM=<el mismo>
GASTOS_ADMIN_CORREOS=dmora@gomezpinedaabogados.com
TWILIO_SID=<el mismo>
TWILIO_AUTH_TOKEN=<el mismo>
TWILIO_WHATSAPP_FROM=<el mismo>

CORREO_TESORERIA=grupotesoreria@gomezpinedaabogados.com
CORREO_LEGALIZACION=legalizaciongastos@gomezpinedaabogados.com
CORREO_TORRE_CONTROL=torredecontrol@gomezpinedaabogados.com
CORREO_NOVEDADES_VEHICULOS=novedadesvehiculos@gomezpinedaabogados.com
URL_NODEX_GASTOS=https://gastos.nodexgpa.com
URL_NODEX_TRAMITES=https://tramites.nodexgpa.com

GOOGLE_MAPS_API_KEY=<clave del servidor>
API_KEY_EXTERNA=<una nueva>

# Notificaciones push de la app de tramitadores. Generarlas UNA vez en el servidor con
#   cd Backend && npx web-push generate-vapid-keys
# y conservarlas (pasan iguales a producción): si cambian, los celulares deben volver a abrir la app
VAPID_PUBLIC_KEY=<clave pública>
VAPID_PRIVATE_KEY=<clave privada>
VAPID_CONTACTO=https://tramitadores.nodexgpa.com
```
Crear el recurso compartido `nodex-ensayo` en la cuenta de Azure Storage (Portal → Cuenta de
almacenamiento → Recursos compartidos de archivos → + Recurso compartido).

### 5.2 Frontends (las `NEXT_PUBLIC_` se fijan al compilar: ponerlas ANTES del paso 6)

`Frontend/frontend/.env`
```ini
API_URL=http://127.0.0.1:9000/api
GASTOS_URL=https://gastos.nodexgpa.com
NEXT_PUBLIC_URL_APP_TRAMITADORES=https://tramitadores.nodexgpa.com
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<clave del navegador>
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=
```
`Frontend/gastos/.env` y `Frontend/tramitadores/.env`
```ini
API_URL=http://127.0.0.1:9000/api
```

## 6. Instalar y compilar

```bash
cd /home/desarrolloti/nodex5.0/Backend && npm ci && npm run build
cd /home/desarrolloti/nodex5.0/Frontend/frontend && npm ci && npm run build
cd /home/desarrolloti/nodex5.0/Frontend/gastos && npm ci && npm run build
cd /home/desarrolloti/nodex5.0/Frontend/tramitadores && npm ci && npm run build
```
Usar `npm ci` **sin** `--production`: el build necesita las dependencias de desarrollo.

## 7. Arrancar con PM2

```bash
cd /home/desarrolloti/nodex5.0
pm2 start deploy/ecosystem.ensayo.config.js
pm2 logs nodex-ensayo-api --lines 40
```
En el log deben salir, en este orden aproximado:
- `REST API en el puerto 9000`
- `Conexion Exitosa` (si sale **"Fallo la Conexion a la base de Datos"**, detener con
  `pm2 stop nodex-ensayo-api` y revisar el error de arriba)
- `🧪 MODO ENSAYO: notificaciones automáticas NO programadas…`

Comprobar todo:
```bash
pm2 list                                   # 5 procesos nodex-ensayo-* en "online"
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:9001   # 200 o 307
redis-cli -n 1 keys 'bull:notifications:*' | head   # el ensayo usa la base 1
pm2 save                                   # recordar los procesos tras un reinicio
```

## 8. Nginx y HTTPS

```bash
sudo apt install -y nginx certbot python3-certbot-nginx      # si no están
sudo cp /home/desarrolloti/nodex5.0/deploy/nginx-nodexgpa.conf /etc/nginx/sites-available/nodexgpa
sudo ln -s /etc/nginx/sites-available/nodexgpa /etc/nginx/sites-enabled/nodexgpa
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d tramites.nodexgpa.com -d gastos.nodexgpa.com -d tramitadores.nodexgpa.com -d api.nodexgpa.com
```
Firewall (si `ufw` está activo):
```bash
sudo ufw allow 'Nginx Full'
sudo ufw status            # 9000-9003 NO deben aparecer abiertos
```

## 9. Después del primer arranque

**Primer acceso (descubierto en el ensayo, 2026-10-06):** la producción actual (4.5) no tiene perfiles: al primer arranque se crean los roles en `gastos_roles`, pero **nadie los tiene asignados** y todos los usuarios caen en "Sin acceso". Hay que darle ADMIN a quien administre (por SQL, una sola vez) y desde **Administración** asignar el perfil de cada usuario:
```bash
sudo -u postgres psql -d BASE -c "INSERT INTO gastos_usuario_roles (usuario_id, rol_id, created_at, updated_at) SELECT u.id, r.id, NOW(), NOW() FROM \"Usuarios\" u JOIN gastos_roles r ON r.codigo = 'ADMIN' WHERE LOWER(u.\"correoUsuario\") = 'dmorasu@gmail.com' ON CONFLICT (usuario_id, rol_id) DO NOTHING;"
```


```bash
cd /home/desarrolloti/nodex5.0/Backend
# Estado actual de los trámites (primero sin --aplicar para ver qué cambia)
node dist/scripts/sincronizarEstadoActual.js
node dist/scripts/sincronizarEstadoActual.js --aplicar
```
- En Nodex Trámites → Administración: asignar perfiles **Analista de trámites**,
  **Administrador Torre de control**, **Tesorería - Certificados** y **Dirección de Negocio**.
- Revisar en Asignación de analistas que los municipios tengan su analista (paso 3.1).

## 10. Pruebas del ensayo

1. Entrar a las 3 apps por https (candado válido) con un usuario de cada perfil.
2. Nodex Gastos: crear un gasto → **Programar pago** → con un usuario Dirección de Negocio
   **Aprobar** → en Tesorería → Programados, **adjuntar soporte y confirmar**. Revisar la bolsa,
   el gasto en Pagado y la lista de egresos de Contabilidad.
3. Certificados: pagar directo desde Tesorería - Certificados.
4. Correos: todos deben llegar **solo** a `CORREO_ENSAYO`, con el asunto `[ENSAYO · para …]`.
   En `pm2 logs nodex-ensayo-worker` los WhatsApp salen como "NO enviado".
5. Trámites: desistir, finalizar y programar un trámite; revisar los correos.
6. App de tramitadores desde un celular (https://tramitadores.nodexgpa.com).

## Pasar a producción

Ver [GUIA_PASO_A_PRODUCCION.md](GUIA_PASO_A_PRODUCCION.md): apuntar esta misma instalación a la base `nodex`, quitar el modo ensayo y apagar la 4.5.

## Actualizar el ensayo con cambios nuevos

Todo como `root` (`sudo -i`). La producción 4.5 no se toca.

1. **Respaldar la base del ensayo** (el arranque puede crear tablas y columnas):
   ```bash
   cd /tmp && sudo -u postgres pg_dump -Fc nodex_pruebas > /tmp/nodex_pruebas_antes_$(date +%Y%m%d_%H%M).dump
   ```
2. **Traer el código** y anotar el commit anterior (para volver si hace falta):
   ```bash
   cd /home/desarrolloti/nodex5.0 && git log --oneline -1 && git pull origin desarrollo && git log --oneline -1
   ```
3. **Variables nuevas** del `.env` que pida la versión (ver "Variables por versión" abajo).
4. **Compilar** el backend y las apps que cambiaron, **una por una** (para no quedarse sin memoria). Si un build falla, no seguir:
   ```bash
   cd /home/desarrolloti/nodex5.0/Backend && npm ci && npm run build
   cd /home/desarrolloti/nodex5.0/Frontend/frontend && npm ci && npm run build
   cd /home/desarrolloti/nodex5.0/Frontend/gastos && npm ci && npm run build
   cd /home/desarrolloti/nodex5.0/Frontend/tramitadores && npm ci && npm run build
   ```
5. **Reiniciar** y revisar el log (`Conexion Exitosa`, `🧪 MODO ENSAYO…`; si sale "Fallo la Conexion…", `pm2 stop nodex-ensayo-api` y revisar el error):
   ```bash
   pm2 restart nodex-ensayo-api nodex-ensayo-worker nodex-ensayo-tramites nodex-ensayo-gastos nodex-ensayo-tramitadores --update-env
   pm2 logs nodex-ensayo-api --lines 40 --nostream | grep -v "dotenv@"
   pm2 list
   ```
6. **Volver atrás** si algo sale mal: `git checkout <commit anterior>`, recompilar (paso 4), reiniciar (paso 5) y, si hace falta, restaurar la base:
   `sudo -u postgres pg_restore --clean --if-exists -d nodex_pruebas --no-owner --role=desarrolloti /tmp/nodex_pruebas_antes_XXXX.dump`. Para volver a la versión nueva: `git checkout desarrollo`.

### Variables por versión

**Commit `0659fe27` (2026-10-07: anticipos, arqueo, push, cargue masivo en pantalla)** — cambian el backend y las tres apps.
- Generar **una sola vez** las claves de las notificaciones push y agregarlas a `Backend/.env`. **Guardarlas en el gestor de contraseñas: son las mismas que van a producción** (si cambian, cada celular debe volver a activar las notificaciones):
  ```bash
  cd /home/desarrolloti/nodex5.0/Backend && npm ci && npx web-push generate-vapid-keys
  ```
  ```ini
  VAPID_PUBLIC_KEY=<Public Key>
  VAPID_PRIVATE_KEY=<Private Key>
  VAPID_CONTACTO=https://tramitadores.nodexgpa.com
  ```
- En el log debe salir además `⏰ Reintegros por enviar: 09:00 …` (el recordatorio push sí corre en el ensayo: solo llega a celulares que lo activaron en la app del ensayo).
- Comprobar la base: `sudo -u postgres psql -d nodex_pruebas -c "\dt gastos_anticipos*" -c "\dt gastos_clientes_empresariales" -c "\dt tramitadores_suscripciones_push"`.
- En pantalla, una vez: Tesorería → Bolsas → **Nueva bolsa** de tipo **Anticipos de clientes**; **Configuración → Catálogos → Clientes empresariales** (ej. Davivienda; desde el commit `49bf242d` los crea el Administrador, ya no Contabilidad).
- Pruebas: cargue masivo de trámites "En pantalla" (con una fila con gasto) y "Subir documentos de estos trámites"; anticipo → confirmar en Contabilidad → Crear gasto → pagar en Tesorería → **Gastos de anticipos** → arqueo y estado de cuenta en la bolsa; dos lotes generales aprobados confirmados juntos en **Programados**; en el celular, **Activar notificaciones** en la app de tramitadores y asignarle un trámite. Recargar con Ctrl+F5 para ver los íconos nuevos.

**Commits `49bf242d`, `15185c64` y `a9e59dc4` (2026-10-10: solicitudes de factura, catálogos de Gastos, avisos nuevos, caja menor, vista en el celular)** — cambian el backend, Gastos, Trámites y Tramitadores (solo los avisos).
- **Sin variables nuevas obligatorias ni dependencias nuevas.** Opcional pero recomendado: `URL_NODEX_GASTOS=https://gastos.nodexgpa.com` en `Backend/.env` (pone el botón "Abrir Nodex Gastos" en los correos; reiniciar también el worker).
- El arranque crea solo lo nuevo: columnas `clase`, `numero_factura` y `fecha_facturacion` en `gastos_anticipos`; tablas `gastos_usuarios_caja`, `gastos_legalizaciones_caja`, `gastos_reembolsos_caja` y `gastos_trazabilidad_reembolsos_caja`; columnas de caja en `gastos_bolsas` y `reembolso_caja_id` en `gastos_documentos`; forma de pago **Caja menor**, 4 estados de gasto, el rol **Auxiliar de Tesorería - Caja menor** y 4 tipos de documento.
- Comprobar la base:
  ```bash
  sudo -u postgres psql -d nodex_pruebas -c "\dt gastos_*caja*" -c "SELECT codigo FROM gastos_formas_pago WHERE codigo = 'CAJA_MENOR'" -c "SELECT codigo FROM gastos_roles WHERE codigo = 'AUXILIAR_TESORERIA_CAJA'" -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'gastos_anticipos' AND column_name = 'clase'"
  ```
- En pantalla, una vez: Tesorería → Bolsas → **Nueva bolsa** de tipo **Anticipos facturados**; Tesorería → **Caja menor → Configurar cajas**: crear "Caja menor Medellín" y "Caja menor Bogotá" (fondo 15.000.000, tope 400.000); dar el rol **Auxiliar de Tesorería - Caja menor** a la asistente de Bogotá y asignarle esa caja en "Auxiliares de cada caja".
- Pruebas: solicitud de factura → Contabilidad → **Confirmar y facturar** (PDF y XML) → correo con adjuntos en `CORREO_ENSAYO`; gasto con forma de pago **Caja menor** → entregar efectivo → legalizar con soporte → armar reembolso → aprobar con Dirección de Negocio → legalizar el reembolso → revisar el **Historial** y el Excel; Catálogos con el Administrador; abrir Gastos y Trámites desde un celular (menú ☰ en Gastos; Dashboard y Tablero de gestión sin zoom). Recargar con Ctrl+F5.

## Si algo sale mal

```bash
pm2 stop /^nodex-ensayo-/       # detiene solo los procesos del ensayo
pm2 delete /^nodex-ensayo-/     # los quita de PM2 (luego: pm2 save)
```
La producción (puertos 4000/3000, Redis base 0, su base de datos) no se toca en ningún paso.
