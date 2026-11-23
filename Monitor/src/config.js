'use strict'
// Configuración del monitor. Todo sale de Monitor/.env (ver .env.example) para no tocar código en el servidor.
const fs = require('fs')
const path = require('path')

const archivoEnv = process.env.MONITOR_ENV || path.join(__dirname, '..', '.env')
if (fs.existsSync(archivoEnv)) process.loadEnvFile(archivoEnv)

const texto = (nombre, defecto = '') => (process.env[nombre] ?? '').trim() || defecto
const numero = (nombre, defecto) => {
  const valor = Number(process.env[nombre])
  return process.env[nombre]?.trim() && Number.isFinite(valor) ? valor : defecto
}
const lista = (nombre, defecto = '') => texto(nombre, defecto).split(',').map(s => s.trim()).filter(Boolean)
const comando = (nombre, defecto) => texto(nombre, defecto).split(/\s+/).filter(Boolean)

module.exports = {
  puerto: numero('MONITOR_PUERTO', 9010),
  dirDatos: texto('MONITOR_DIR_DATOS', '/var/lib/nodex-monitor'),
  intervaloSeg: numero('MONITOR_INTERVALO_SEG', 60),

  // Acceso al panel
  usuario: texto('MONITOR_USUARIO'),
  claveHash: texto('MONITOR_CLAVE_HASH'),
  // Solo "no" en pruebas locales por http
  cookieSegura: texto('MONITOR_COOKIE_SEGURA', 'si') !== 'no',
  horasSesion: numero('MONITOR_HORAS_SESION', 12),

  // El monitor usa sudo cada minuto: esas líneas de auth.log no son eventos de seguridad
  usuarioSistema: texto('MONITOR_USUARIO_SISTEMA', 'nodexmon'),
  // Envoltorios de solo lectura (deploy/monitor): PM2 corre como root (/root/.pm2) y Postgres como postgres
  cmdPm2: comando('MONITOR_CMD_PM2', 'sudo -n -u root /usr/local/bin/nodex-monitor-pm2'),
  cmdPostgres: comando('MONITOR_CMD_POSTGRES', 'sudo -n -u postgres /usr/local/bin/nodex-monitor-pg'),
  procesosIgnorar: lista('MONITOR_PROCESOS_IGNORAR'),

  redis: {
    host: texto('REDIS_HOST', '127.0.0.1'),
    puerto: numero('REDIS_PORT', 6379),
    db: numero('REDIS_DB', 0),
    clave: texto('REDIS_PASSWORD')
  },
  colas: lista('MONITOR_COLAS', 'notifications'),

  sitios: lista('MONITOR_SITIOS', 'https://tramites.nodexgpa.com,https://gastos.nodexgpa.com,https://tramitadores.nodexgpa.com,https://api.nodexgpa.com'),
  logsNginx: lista('MONITOR_LOGS_NGINX', '/var/log/nginx/access.log'),
  logAuth: texto('MONITOR_LOG_AUTH', '/var/log/auth.log'),
  logRespaldo: texto('MONITOR_LOG_RESPALDO', '/var/log/respaldo-nodex.log'),
  discos: lista('MONITOR_DISCOS', '/'),
  puertosPermitidos: lista('MONITOR_PUERTOS_PERMITIDOS', '22,80,443').map(Number),
  ipsConocidas: lista('MONITOR_IPS_CONOCIDAS'),

  // Umbrales. Los de capacidad son los mismos de capacidad-nodex.sh (aviso) y uno más alto (urgente).
  // CPU solo es urgente si dura: un npm run build la sube al 95 % unos minutos.
  umbrales: {
    cpuUrgente: numero('MONITOR_UMBRAL_CPU', 90),
    cpuMinutos: numero('MONITOR_UMBRAL_CPU_MINUTOS', 15),
    ramAvisoMb: numero('MONITOR_UMBRAL_RAM_AVISO_MB', 1500),
    ramUrgenteMb: numero('MONITOR_UMBRAL_RAM_URGENTE_MB', 800),
    swapAvisoMb: numero('MONITOR_UMBRAL_SWAP_AVISO_MB', 200),
    swapUrgenteMb: numero('MONITOR_UMBRAL_SWAP_URGENTE_MB', 1000),
    discoAviso: numero('MONITOR_UMBRAL_DISCO_AVISO', 80),
    discoUrgente: numero('MONITOR_UMBRAL_DISCO_URGENTE', 90),
    sitioLentoMs: numero('MONITOR_UMBRAL_SITIO_LENTO_MS', 5000),
    certAvisoDias: 14,
    certUrgenteDias: 3,
    reiniciosUrgente: 3,          // reinicios del mismo proceso en 15 min: se está cayendo en bucle
    pgConexionesPct: 80,
    colaEsperaAviso: 200,
    colaFallidosHora: 20,
    errores5xx5min: numero('MONITOR_UMBRAL_5XX', 20),
    ipPorMinutoAviso: numero('MONITOR_UMBRAL_IP_AVISO', 600),
    ipPorMinutoUrgente: numero('MONITOR_UMBRAL_IP_URGENTE', 3000),
    sshFallidos10min: numero('MONITOR_UMBRAL_SSH', 50),
    loginNodex10min: numero('MONITOR_UMBRAL_LOGIN_NODEX', 20),
    loginMonitor15min: 5,
    respaldoHoras: 26
  },

  // Avisos
  notificar: texto('MONITOR_NOTIFICAR', 'si') !== 'no',
  correos: lista('MONITOR_CORREOS'),
  whatsapp: lista('MONITOR_WHATSAPP'),
  sendgridClave: texto('SENDGRID_API_KEY'),
  correoDe: texto('EMAIL_FROM'),
  twilio: {
    sid: texto('TWILIO_SID'),
    token: texto('TWILIO_AUTH_TOKEN'),
    desde: texto('TWILIO_WHATSAPP_FROM'),
    plantilla: texto('MONITOR_TWILIO_PLANTILLA')
  },
  repetirUrgenteMin: numero('MONITOR_REPETIR_URGENTE_MIN', 120),
  // Tope para que una falla que va y viene no gaste mensajes de Twilio sin control
  maxWhatsappHora: numero('MONITOR_MAX_WHATSAPP_HORA', 6)
}
