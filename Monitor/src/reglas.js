'use strict'
// Qué es urgente (WhatsApp + correo) y qué es aviso (correo). Hay dos clases:
// - condiciones: duran (CPU alta, proceso caído) y se avisa cuando empiezan y cuando se resuelven;
// - eventos: pasan una vez (alguien entró por SSH) y se avisan una vez.
const { fechaHora } = require('./utilidades')

// Lecturas seguidas en que se cumple cada condición. Una alerta ya activa se sostiene con una sola
// lectura (así no se "resuelve" sola al reiniciar el monitor ni rebota alrededor del umbral).
const rachas = new Map()

const sumaVentana = (ventana, minutos, campo) => {
  const desde = Date.now() - minutos * 60000
  return ventana.filter(v => v.t >= desde).reduce((s, v) => s + (v[campo] || 0), 0)
}

const evaluar = (l, ventana, activas, config) => {
  const u = config.umbrales
  const lecturasPor = minutos => Math.max(1, Math.round(minutos * 60 / config.intervaloSeg))
  const condiciones = []
  const eventos = []

  const sostenido = (id, cumple, lecturas) => {
    const n = cumple ? (rachas.get(id) || 0) + 1 : 0
    rachas.set(id, n)
    return cumple && (n >= lecturas || Boolean(activas[id]))
  }
  const agregar = (id, nivel, titulo, detalle = '') => condiciones.push({ id, nivel, titulo, detalle })
  // Si una fuente no se pudo leer, sus alertas activas siguen igual (no se dan por resueltas)
  const mantener = prefijo => {
    for (const [id, a] of Object.entries(activas)) {
      if (id.startsWith(prefijo)) agregar(id, a.nivel, a.titulo, a.detalle)
    }
  }

  // --- Capacidad ---
  const s = l.sistema
  if (!s.error) {
    if (sostenido('cpu', s.cpu >= u.cpuUrgente, lecturasPor(u.cpuMinutos))) {
      agregar('cpu', 'urgente', `CPU al ${s.cpu} %`, `Sobre ${u.cpuUrgente} % por más de ${u.cpuMinutos} min. Carga ${s.carga.join(' / ')} con ${s.nucleos} núcleos.`)
    }
    const ram = s.memoria.disponibleMb
    const ramUrgente = sostenido('ram-u', ram <= u.ramUrgenteMb, 3) || (ram <= u.ramUrgenteMb && activas.ram?.nivel === 'urgente')
    if (sostenido('ram', ram <= u.ramAvisoMb, 5) || ramUrgente) {
      agregar('ram', ramUrgente ? 'urgente' : 'aviso', `RAM disponible: ${ram} MB`, `De ${s.memoria.totalMb} MB. Swap en uso ${s.memoria.swapUsadaMb} MB.`)
    }
    const swap = s.memoria.swapUsadaMb
    if (sostenido('swap', swap >= u.swapAvisoMb, 5)) {
      agregar('swap', swap >= u.swapUrgenteMb ? 'urgente' : 'aviso', `Swap en uso: ${swap} MB`, 'El servidor se está quedando corto de RAM.')
    }
    for (const d of s.discos) {
      if (d.pct >= u.discoAviso) {
        agregar(`disco-${d.montaje}`, d.pct >= u.discoUrgente ? 'urgente' : 'aviso', `Disco ${d.montaje} al ${d.pct} %`, `Quedan ${d.libreGb} GB de ${d.totalGb} GB.`)
      }
    }
  }

  // --- Procesos de PM2 ---
  const pm2 = l.pm2
  if (pm2.error) {
    if (sostenido('pm2-error', true, 3)) agregar('pm2-error', 'aviso', 'No se puede leer PM2', pm2.error)
    mantener('proc-')
  } else {
    rachas.set('pm2-error', 0)
    for (const p of pm2.procesos) {
      if (sostenido(`proc-${p.nombre}`, p.estado !== 'online', 2)) {
        agregar(`proc-${p.nombre}`, 'urgente', `Proceso ${p.nombre}: ${p.estado}`, 'PM2 no lo tiene en línea.')
      }
      // Reinicios en los últimos 15 min (un despliegue reinicia una vez; tres es un bucle de caídas)
      const hace15 = ventana.find(v => v.t >= Date.now() - 15 * 60000 && v.reinicios?.[p.nombre] !== undefined)
      const reinicios = hace15 ? p.reinicios - hace15.reinicios[p.nombre] : 0
      if (sostenido(`proc-bucle-${p.nombre}`, reinicios >= u.reiniciosUrgente, 1)) {
        agregar(`proc-bucle-${p.nombre}`, 'urgente', `${p.nombre} se reinició ${reinicios} veces en 15 min`, 'Se está cayendo y PM2 lo levanta. Revisar pm2 logs.')
      }
    }
    // Un proceso que estaba en la última hora y ya no aparece (pm2 delete, o PM2 murió y
    // jlist levantó un PM2 vacío, que no tendría ningún proceso "caído" que avisar)
    const actuales = new Set(pm2.procesos.map(p => p.nombre))
    const recientes = new Set(ventana.flatMap(v => Object.keys(v.reinicios || {})))
    for (const nombre of recientes) {
      if (!actuales.has(nombre) && !config.procesosIgnorar.includes(nombre)) {
        agregar(`proc-${nombre}`, 'urgente', `Proceso ${nombre}: ya no está en PM2`, 'Si se quitó a propósito, agregarlo a MONITOR_PROCESOS_IGNORAR o esperar una hora.')
      }
    }
  }

  // --- Postgres ---
  const pg = l.servicios.postgres
  if (pg.error) {
    if (sostenido('pg-caido', true, 2)) agregar('pg-caido', 'urgente', 'Postgres no responde', pg.error)
    mantener('pg-')
  } else {
    rachas.set('pg-caido', 0)
    const pct = Math.round(100 * pg.conexiones / pg.maximo)
    if (pct >= u.pgConexionesPct) agregar('pg-conexiones', 'aviso', `Postgres con ${pg.conexiones} de ${pg.maximo} conexiones`, `${pct} % del máximo.`)
    if (sostenido('pg-lentas', pg.lentas > 0, 3)) agregar('pg-lentas', 'aviso', `${pg.lentas} consulta(s) de más de 5 min en Postgres`, 'Ver pg_stat_activity.')
    if (sostenido('pg-bloqueos', pg.bloqueadas >= 5, 3)) agregar('pg-bloqueos', 'aviso', `${pg.bloqueadas} consultas esperando un bloqueo`, 'Ver pg_locks.')
  }

  // --- Redis y la cola de notificaciones ---
  const rd = l.servicios.redis
  if (rd.error) {
    if (sostenido('redis-caido', true, 2)) agregar('redis-caido', 'urgente', 'Redis no responde', `${rd.error}. Sin Redis no salen notificaciones ni correos.`)
    mantener('cola-')
  } else {
    rachas.set('redis-caido', 0)
    for (const c of rd.colas) {
      if (sostenido(`cola-${c.nombre}`, c.espera >= u.colaEsperaAviso, 5)) {
        agregar(`cola-${c.nombre}`, 'aviso', `Cola ${c.nombre} con ${c.espera} trabajos en espera`, '¿Está arriba nodex-worker?')
      }
      const haceUnaHora = ventana.find(v => v.t >= Date.now() - 60 * 60000 && v.colaFallidos?.[c.nombre] !== undefined)
      const nuevosFallidos = haceUnaHora ? c.fallidos - haceUnaHora.colaFallidos[c.nombre] : 0
      if (nuevosFallidos >= u.colaFallidosHora) {
        agregar(`cola-fallidos-${c.nombre}`, 'aviso', `${nuevosFallidos} trabajos fallidos en la cola ${c.nombre} en 1 h`, 'Correos o WhatsApp que no salieron.')
      }
    }
  }

  // --- Sitios públicos ---
  for (const sitio of l.sitios) {
    const host = new URL(sitio.url).host
    if (sostenido(`sitio-${host}`, Boolean(sitio.error), 2)) {
      agregar(`sitio-${host}`, 'urgente', `${host} no responde`, sitio.error)
    } else if (sostenido(`lento-${host}`, !sitio.error && sitio.ms >= u.sitioLentoMs, 3)) {
      agregar(`lento-${host}`, 'aviso', `${host} lento: ${(sitio.ms / 1000).toFixed(1)} s`, `Más de ${u.sitioLentoMs / 1000} s por respuesta.`)
    }
    const dias = sitio.certificado?.dias
    if (Number.isFinite(dias) && dias <= u.certAvisoDias) {
      agregar(`cert-${host}`, dias <= u.certUrgenteDias ? 'urgente' : 'aviso', `Certificado de ${host} vence en ${dias} días`, 'Revisar certbot renew.')
    }
  }

  // --- Tráfico (Nginx) ---
  const nx = l.registros.nginx
  if (nx.errores.length) {
    if (sostenido('log-nginx', true, 3)) agregar('log-nginx', 'aviso', 'No se puede leer el log de Nginx', nx.errores.join('; '))
    mantener('ip-')
  } else {
    rachas.set('log-nginx', 0)
    const e5xx = sumaVentana(ventana, 5, 's5xx')
    if (e5xx >= u.errores5xx5min) agregar('errores-5xx', 'aviso', `${e5xx} errores 5xx en 5 min`, 'Las apps están fallando a los usuarios.')
    const minutos = config.intervaloSeg / 60
    for (const [ip, n] of Object.entries(nx.porIp)) {
      const porMinuto = Math.round(n / minutos)
      if (porMinuto >= u.ipPorMinutoAviso) {
        agregar(`ip-${ip}`, porMinuto >= u.ipPorMinutoUrgente ? 'urgente' : 'aviso', `La IP ${ip} hace ${porMinuto} peticiones por minuto`, 'Posible ataque o robot. Se puede bloquear en Nginx o en el NSG de Azure.')
      }
    }
  }

  // --- SSH, sudo y cuentas del sistema (auth.log) ---
  const au = l.registros.auth
  if (au.error) {
    if (sostenido('log-auth', true, 3)) agregar('log-auth', 'aviso', 'No se puede leer auth.log', `${au.error}. Sin él no se vigila SSH. ¿nodexmon está en el grupo adm?`)
  } else {
    rachas.set('log-auth', 0)
    const ssh10 = sumaVentana(ventana, 10, 'sshFallidos')
    if (ssh10 >= u.sshFallidos10min) agregar('ssh-fuerza', 'aviso', `${ssh10} intentos fallidos de SSH en 10 min`, 'Alguien está probando contraseñas.')
    for (const acceso of au.accesos) {
      const conocida = config.ipsConocidas.some(ip => acceso.ip === ip || (ip.endsWith('.') && acceso.ip.startsWith(ip)))
      if (!conocida) {
        eventos.push({ nivel: 'urgente', titulo: `Acceso SSH de ${acceso.usuario} desde una IP desconocida`, detalle: `${acceso.ip} (${acceso.metodo}) el ${fechaHora(Date.now())}. Si no fuiste tú, cambia la clave y revisa el servidor.` })
      }
    }
    for (const cuenta of au.cuentas) eventos.push({ nivel: 'urgente', titulo: 'Cambio en las cuentas del sistema', detalle: cuenta })
    if (au.sudoFallidos) eventos.push({ nivel: 'aviso', titulo: `${au.sudoFallidos} intento(s) fallido(s) de sudo`, detalle: 'Alguien escribió mal la contraseña de sudo.' })
  }

  // --- Logins fallidos de Nodex y del monitor ---
  const login10 = sumaVentana(ventana, 10, 'loginNodex')
  if (login10 >= u.loginNodex10min) agregar('login-nodex', 'aviso', `${login10} inicios de sesión fallidos en Nodex en 10 min`, 'Posible prueba de contraseñas contra Nodex.')
  const monitor15 = sumaVentana(ventana, 15, 'loginMonitor')
  if (monitor15 >= u.loginMonitor15min) agregar('login-monitor', 'aviso', `${monitor15} intentos fallidos de entrar al monitor en 15 min`, 'Alguien prueba claves en monitor.nodexgpa.com.')

  // --- Puertos y respaldo ---
  const seg = l.seguridad
  for (const p of seg.puertos?.lista || []) {
    if (!p.permitido) agregar(`puerto-${p.protocolo}-${p.puerto}`, 'aviso', `Puerto ${p.puerto}/${p.protocolo} abierto en ${p.direccion}`, 'No está en MONITOR_PUERTOS_PERMITIDOS. Confirmar que el NSG de Azure lo tiene cerrado.')
  }
  const resp = seg.respaldo
  if (resp && !resp.error) {
    if (resp.incompleto) agregar('respaldo', 'aviso', 'El último respaldo quedó incompleto', resp.incompleto)
    else if (!resp.ultimoCompleto || Date.now() - resp.ultimoCompleto > u.respaldoHoras * 3600000) {
      agregar('respaldo', 'aviso', 'No hay respaldo completo reciente', resp.ultimoCompleto ? `El último fue el ${fechaHora(resp.ultimoCompleto)}.` : 'No hay ninguno en el log.')
    }
  }

  return { condiciones, eventos }
}

module.exports = { evaluar }
