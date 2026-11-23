'use strict'
// Nodex Monitor: cada minuto mide el servidor, evalúa las reglas y avisa; además sirve el panel.
const config = require('./config')
const almacen = require('./almacen')
const { crearAjustes } = require('./ajustes')
const reglas = require('./reglas')
const alertas = require('./alertas')
const { crearNotificador } = require('./notificaciones')
const { crearServidor } = require('./web')
const { seguro, fechaHora } = require('./utilidades')
const sistema = require('./recolectores/sistema')
const procesos = require('./recolectores/procesos')
const servicios = require('./recolectores/servicios')
const sitios = require('./recolectores/sitios')
const registros = require('./recolectores/registros')
const seguridad = require('./recolectores/seguridad')

if (!config.usuario || !config.claveHash) console.warn('⚠️  Sin MONITOR_USUARIO o MONITOR_CLAVE_HASH: nadie podrá entrar al panel.')

const estado = almacen.cargar(config.dirDatos)
// Antes de la primera lectura: suma al config las IPs y puertos agregados desde el panel
const ajustes = crearAjustes(config)
const notificador = crearNotificador(config)
const HORAS_HISTORIA = 24
let ultimaLectura = null
let intentosMonitor = 0

const ciclo = async () => {
  const inicio = Date.now()
  const [s, pm2, serv, sit, seg] = await Promise.all([
    seguro('sistema', () => sistema.recolectar(config)),
    seguro('pm2', () => procesos.recolectar(config)),
    seguro('servicios', () => servicios.recolectar(config)),
    seguro('sitios', () => sitios.recolectar(config)),
    seguro('seguridad', () => seguridad.recolectar(config))
  ])
  const reg = registros.recolectar(config)
  const lectura = {
    t: inicio,
    sistema: s,
    pm2: pm2.procesos ? pm2 : { ...pm2, procesos: [] },
    servicios: serv.postgres ? serv : { postgres: { error: serv.error }, redis: { error: serv.error } },
    sitios: Array.isArray(sit) ? sit : [],
    registros: reg,
    seguridad: seg
  }

  // Contadores de este minuto: con ellos salen las sumas de 5, 10 y 60 minutos
  const ip = Object.entries(reg.nginx.porIp).sort((a, b) => b[1] - a[1]).slice(0, 15)
  estado.ventana.push({
    t: inicio,
    peticiones: reg.nginx.total,
    s5xx: reg.nginx.s5xx,
    denegadas: reg.nginx.denegadas,
    sondeos: reg.nginx.sondeos,
    porIp: Object.fromEntries(ip),
    sshFallidos: reg.auth.fallidos,
    sshPorIp: reg.auth.fallidosPorIp,
    loginNodex: lectura.pm2.loginFallidosNuevos || 0,
    loginMonitor: intentosMonitor,
    reinicios: lectura.pm2.error ? undefined : Object.fromEntries(lectura.pm2.procesos.map(p => [p.nombre, p.reinicios])),
    colaFallidos: serv.redis?.colas ? Object.fromEntries(serv.redis.colas.map(c => [c.nombre, c.fallidos])) : undefined
  })
  intentosMonitor = 0
  estado.ventana = estado.ventana.filter(v => v.t >= inicio - 60 * 60000)

  // Eventos de seguridad para el panel (accesos, sudo, cuentas, sondeos)
  const evento = (tipo, detalle, ip) => estado.eventos.unshift({ t: inicio, tipo, detalle, ip })
  for (const a of reg.auth.accesos) evento('ssh', `Entró ${a.usuario} (${a.metodo})`, a.ip)
  for (const x of reg.auth.sudo) evento('sudo', `${x.usuario}: ${x.comando}`)
  for (const c of reg.auth.cuentas) evento('cuenta', c)
  for (const x of reg.nginx.ejemplosSondeo.slice(0, 2)) evento('sondeo', x.camino, x.ip)
  estado.eventos.length = Math.min(estado.eventos.length, 150)

  const { condiciones, eventos } = reglas.evaluar(lectura, estado.ventana, estado.activas, config)
  estado.nombreServidor = s.nombre
  // Las ocultas desde el panel no avisan ni se muestran (se sacaron de activas al ocultarlas)
  await alertas.procesar(condiciones.filter(c => !ajustes.oculta(c.id)), eventos, estado, config, notificador)

  if (!s.error) {
    estado.historia.push({
      t: inicio,
      cpu: s.cpu,
      ram: s.memoria.disponibleMb,
      swap: s.memoria.swapUsadaMb,
      disco: Math.max(...s.discos.map(d => d.pct), 0),
      peticiones: reg.nginx.total,
      s5xx: reg.nginx.s5xx,
      ssh: reg.auth.fallidos,
      pg: serv.postgres?.conexiones ?? null
    })
    estado.historia = estado.historia.filter(h => h.t >= inicio - HORAS_HISTORIA * 3600000)
  }
  ultimaLectura = lectura
  try { almacen.guardar(config.dirDatos, estado) } catch (error) { console.error('[almacen]', error.message) }
}

const sumar = (minutos, campo) => estado.ventana.filter(v => v.t >= Date.now() - minutos * 60000).reduce((s, v) => s + (v[campo] || 0), 0)
const juntarIps = (minutos, campo) => {
  const total = {}
  for (const v of estado.ventana.filter(v => v.t >= Date.now() - minutos * 60000)) {
    for (const [ip, n] of Object.entries(v[campo] || {})) total[ip] = (total[ip] || 0) + n
  }
  return Object.entries(total).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([ip, n]) => ({ ip, n }))
}

const obtenerEstado = () => ({
  ahora: Date.now(),
  intervaloSeg: config.intervaloSeg,
  umbrales: config.umbrales,
  lectura: ultimaLectura && {
    ...ultimaLectura,
    // El panel no necesita los mapas crudos por IP de este minuto
    registros: undefined
  },
  activas: Object.values(estado.activas).sort((a, b) => (a.nivel === b.nivel ? a.desde - b.desde : a.nivel === 'urgente' ? -1 : 1)),
  historial: estado.historial.slice(0, 60),
  eventos: estado.eventos.slice(0, 40),
  historia: estado.historia,
  trafico: {
    peticiones5: sumar(5, 'peticiones'),
    errores5xx60: sumar(60, 's5xx'),
    denegadas60: sumar(60, 'denegadas'),
    sondeos60: sumar(60, 'sondeos'),
    ips5: juntarIps(5, 'porIp'),
    sshFallidos60: sumar(60, 'sshFallidos'),
    sshIps60: juntarIps(60, 'sshPorIp'),
    loginNodex60: sumar(60, 'loginNodex'),
    loginMonitor60: sumar(60, 'loginMonitor')
  },
  ipsConocidas: config.ipsConocidas,
  ajustes: ajustes.resumen()
})

// Acciones del panel. Lo que se oculta o se permite sale de activas sin pasar por el historial ni
// mandar "Resuelto": no se resolvió, se decidió que no es alerta
const quitarActiva = id => { delete estado.activas[id] }
const ejecutarAccion = (accion, d, usuario) => {
  switch (accion) {
    case 'ocultar':
      ajustes.ocultar(d.id, estado.activas[d.id]?.titulo || d.titulo, usuario)
      quitarActiva(d.id)
      break
    case 'mostrar': ajustes.mostrar(d.id); break
    case 'agregar-puerto':
      ajustes.agregarPuerto(d.puerto)
      quitarActiva(`puerto-tcp-${Number(d.puerto)}`)
      quitarActiva(`puerto-udp-${Number(d.puerto)}`)
      break
    case 'quitar-puerto': ajustes.quitarPuerto(d.puerto); break
    case 'agregar-ip': ajustes.agregarIp(d.ip); break
    case 'quitar-ip': ajustes.quitarIp(d.ip); break
    case 'eliminar-historial': {
      const i = estado.historial.findIndex(h => h.desde === d.desde && h.titulo === d.titulo)
      if (i >= 0) estado.historial.splice(i, 1)
      break
    }
    default: throw new Error('Acción no válida')
  }
  almacen.guardar(config.dirDatos, estado)
  return { ok: true }
}

const alIntentoFallido = (ip, usuario) => {
  intentosMonitor++
  estado.eventos.unshift({ t: Date.now(), tipo: 'monitor', detalle: `Clave errada para "${String(usuario).slice(0, 40)}"`, ip })
}

const enviarPrueba = async usuario => {
  const texto = `Prueba de avisos pedida por ${usuario} el ${fechaHora(Date.now())}. Si llegó, los avisos funcionan.`
  const resultado = {}
  for (const [canal, envio] of [['correo', () => notificador.correo('[Nodex servidor] Prueba de avisos', [`✅ ${texto}`])], ['whatsapp', () => notificador.whatsapp(`✅ Nodex servidor: ${texto}`)]]) {
    try { resultado[canal] = await envio() } catch (error) { resultado[canal] = { error: error.message } }
  }
  return resultado
}

crearServidor(config, obtenerEstado, alIntentoFallido, enviarPrueba, ejecutarAccion)

// Un ciclo a la vez: el siguiente se programa cuando termina el anterior
const programar = async () => {
  try { await ciclo() } catch (error) { console.error('[ciclo]', error) }
  setTimeout(programar, config.intervaloSeg * 1000)
}
programar()

const salir = () => { try { almacen.guardar(config.dirDatos, estado) } catch {} process.exit(0) }
process.on('SIGTERM', salir)
process.on('SIGINT', salir)
