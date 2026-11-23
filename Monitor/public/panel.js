'use strict'
// Panel de Nodex Monitor. Todo lo que viene de los logs (usuarios, IPs, rutas) lo escribió alguien
// de afuera: siempre pasa por esc() antes de llegar al HTML.

const $ = id => document.getElementById(id)
const esc = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// --- Formatos propios (dd/mm/aaaa, miles con punto) ---
const dos = n => String(n).padStart(2, '0')
const hora = t => { const d = new Date(t); return `${dos(d.getHours())}:${dos(d.getMinutes())}` }
const fecha = t => { const d = new Date(t); return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}` }
const fechaHora = t => `${fecha(t)} ${hora(t)}`
const miles = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const decimal = (n, d = 1) => n.toFixed(d).replace('.', ',')
const gb = mb => decimal(mb / 1024)
const hace = ms => {
  const min = Math.round(ms / 60000)
  if (min < 1) return 'menos de 1 min'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 48) return `${h} h ${min % 60} min`
  return `${Math.floor(h / 24)} días`
}

// --- Íconos (texto fijo, no datos) ---
const ICONOS = {
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></svg>',
  aviso: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
  urgente: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9Z"/><path d="M12 8v4M12 16h.01"/></svg>',
  neutro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="4"/></svg>'
}
const chip = (nivel, texto) => `<span class="chip chip-${nivel}">${ICONOS[nivel]}${esc(texto)}</span>`
const COLOR_NIVEL = { ok: 'var(--ok)', aviso: 'var(--aviso)', urgente: 'var(--urgente)', neutro: 'var(--texto-apagado)' }
const nivelPor = (valor, aviso, urgente, alReves = false) => alReves
  ? (valor <= urgente ? 'urgente' : valor <= aviso ? 'aviso' : 'ok')
  : (valor >= urgente ? 'urgente' : valor >= aviso ? 'aviso' : 'ok')

let datos = null

// --- Estado general ---
const pintarEstado = () => {
  const caja = $('estado-general')
  if (!datos.lectura) {
    caja.className = 'estado-general estado-cargando'
    caja.innerHTML = 'Esperando la primera lectura…'
    return
  }
  const urgentes = datos.activas.filter(a => a.nivel === 'urgente').length
  const avisos = datos.activas.length - urgentes
  const partes = []
  if (urgentes) partes.push(`${urgentes} urgente${urgentes > 1 ? 's' : ''}`)
  if (avisos) partes.push(`${avisos} aviso${avisos > 1 ? 's' : ''}`)
  const nivel = urgentes ? 'urgente' : avisos ? 'aviso' : 'ok'
  const s = datos.lectura.sistema
  caja.className = `estado-general estado-${nivel}`
  caja.innerHTML = `<span class="icono-estado">${ICONOS[nivel]}</span><span>${nivel === 'ok' ? 'Todo en orden' : esc(partes.join(' · '))}</span>` +
    (s && !s.error ? `<span class="detalle">· ${esc(s.nombre)} · encendido hace ${hace(Date.now() - s.encendidoDesde)}</span>` : '')
}

// --- Indicadores ---
const indicador = (etiqueta, valor, unidad, pct, nivel, pie) => `
  <div class="indicador">
    <div class="etiqueta">${esc(etiqueta)}</div>
    <div class="valor">${valor}${unidad ? ` <small>${esc(unidad)}</small>` : ''}</div>
    <div class="medidor" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" aria-label="${esc(etiqueta)}"><span data-ancho="${Math.min(100, Math.max(2, pct))}" data-nivel="${nivel}"></span></div>
    <div class="pie">${pie}</div>
  </div>`

const pintarIndicadores = () => {
  const s = datos.lectura?.sistema
  const u = datos.umbrales
  if (!s || s.error) { $('indicadores').innerHTML = `<div class="indicador">${chip('aviso', 'Sin lectura del sistema')}</div>`; return }
  const m = s.memoria
  const usadaPct = 100 * (1 - m.disponibleMb / m.totalMb)
  const disco = s.discos[0]
  const cargaPct = 100 * s.carga[0] / s.nucleos
  $('indicadores').innerHTML = [
    indicador('CPU', s.cpu, '%', s.cpu, nivelPor(s.cpu, 70, u.cpuUrgente), `${s.nucleos} núcleos`),
    indicador('RAM disponible', gb(m.disponibleMb), 'GB', usadaPct, nivelPor(m.disponibleMb, u.ramAvisoMb, u.ramUrgenteMb, true), `de ${gb(m.totalMb)} GB · ${Math.round(usadaPct)} % en uso`),
    indicador('Swap en uso', miles(m.swapUsadaMb), 'MB', m.swapTotalMb ? 100 * m.swapUsadaMb / m.swapTotalMb : 0, nivelPor(m.swapUsadaMb, u.swapAvisoMb, u.swapUrgenteMb), `de ${miles(m.swapTotalMb)} MB`),
    disco
      ? indicador(`Disco ${disco.montaje}`, disco.pct, '%', disco.pct, nivelPor(disco.pct, u.discoAviso, u.discoUrgente), `${decimal(disco.libreGb)} GB libres de ${decimal(disco.totalGb)}`)
      : indicador('Disco', '—', '', 0, 'neutro', 'sin lectura'),
    indicador('Carga', decimal(s.carga[0], 2), '', cargaPct, nivelPor(cargaPct, 70, 100), `5 min ${decimal(s.carga[1], 2)} · 15 min ${decimal(s.carga[2], 2)}`)
  ].join('')
  // La CSP no deja atributos style en el HTML: el ancho y el color se ponen desde aquí
  for (const barra of $('indicadores').querySelectorAll('[data-ancho]')) {
    barra.style.width = `${barra.dataset.ancho}%`
    barra.style.background = COLOR_NIVEL[barra.dataset.nivel]
  }
}

// --- Alertas activas ---
const pintarAlertas = () => {
  if (!datos.activas.length) { $('alertas').innerHTML = `<div class="vacio">${chip('ok', 'Sin alertas')}</div>`; return }
  $('alertas').innerHTML = datos.activas.map(a => {
    // Alertas de puerto: "puerto-tcp-5432" → se puede permitir el puerto en vez de solo ocultarla
    const puerto = /^puerto-(?:tcp|udp)-(\d+)$/.exec(a.id)?.[1]
    return `
    <div class="alerta">
      ${chip(a.nivel, a.nivel === 'urgente' ? 'Urgente' : 'Aviso')}
      <div><div class="alerta-titulo">${esc(a.titulo)}</div><div class="alerta-detalle">${esc(a.detalle)}</div>
        <div class="alerta-desde">Desde el ${fechaHora(a.desde)}</div></div>
      <div class="alerta-acciones">
        <div class="alerta-desde">hace ${hace(Date.now() - a.desde)}</div>
        <div class="alerta-botones">
          ${puerto ? `<button class="boton boton-chico" type="button" data-accion="agregar-puerto" data-puerto="${esc(puerto)}">Permitir puerto</button>` : ''}
          <button class="boton boton-chico" type="button" data-accion="ocultar" data-id="${esc(a.id)}" data-titulo="${esc(a.titulo)}">Ocultar</button>
        </div>
      </div>
    </div>`
  }).join('')
}

// --- Gráficas de 24 h (una serie cada una: el título la nombra, sin leyenda) ---
const GRAFICAS = [
  { campo: 'cpu', titulo: 'CPU', unidad: '%', max: () => 100, umbral: u => u.cpuUrgente, formato: v => `${Math.round(v)} %`, resumen: 'max' },
  { campo: 'ram', titulo: 'RAM disponible', unidad: 'GB', escala: v => v / 1024, max: () => (datos.lectura?.sistema?.memoria?.totalMb || 8192) / 1024, umbral: u => u.ramUrgenteMb / 1024, formato: v => `${decimal(v)} GB`, resumen: 'min' },
  { campo: 'peticiones', titulo: 'Peticiones por minuto (Nginx)', formato: v => miles(v), resumen: 'max' },
  { campo: 'pg', titulo: 'Conexiones a Postgres', formato: v => miles(v), resumen: 'max' },
  { campo: 's5xx', titulo: 'Errores 5xx por minuto', formato: v => miles(v), resumen: 'max' },
  { campo: 'ssh', titulo: 'Intentos SSH fallidos por minuto', formato: v => miles(v), resumen: 'max' }
]

const techoBonito = v => {
  if (v <= 5) return 5
  const potencia = 10 ** Math.floor(Math.log10(v))
  return [1, 2, 2.5, 5, 10].map(f => f * potencia).find(c => c >= v)
}

const graficasPintadas = new Map()

const pintarGraficas = () => {
  const contenedor = $('graficas')
  if (!contenedor.childElementCount) {
    contenedor.innerHTML = GRAFICAS.map((g, i) => `
      <div class="grafica" data-i="${i}">
        <h3>${esc(g.titulo)}<span data-actual></span></h3>
        <svg role="img" aria-label="${esc(g.titulo)}, últimas 24 horas"></svg>
        <details><summary>Tabla</summary><div class="tabla-contenedor" data-tabla></div></details>
      </div>`).join('')
  }
  const historia = datos.historia
  const ahora = datos.ahora
  const desde = ahora - 24 * 3600000
  // Más de 5 min sin lectura (o 3 ciclos) es un hueco: el monitor estuvo apagado y no se une la línea
  const hueco = Math.max(datos.intervaloSeg * 1000 * 3, 5 * 60000)

  GRAFICAS.forEach((g, i) => {
    const caja = contenedor.querySelector(`[data-i="${i}"]`)
    const svg = caja.querySelector('svg')
    const ancho = svg.clientWidth || 500
    const alto = 150
    const izq = 34
    const abajo = 18
    const escala = g.escala || (v => v)
    const puntos = historia.filter(h => h[g.campo] !== null && h[g.campo] !== undefined).map(h => ({ t: h.t, v: escala(h[g.campo]) }))
    const ultimo = puntos[puntos.length - 1]
    caja.querySelector('[data-actual]').textContent = ultimo ? g.formato(ultimo.v) : '—'

    const umbral = g.umbral ? g.umbral(datos.umbrales) : null
    const maxDatos = Math.max(0, ...puntos.map(p => p.v))
    const techo = g.max ? g.max() : techoBonito(Math.max(maxDatos * 1.1, 1))
    const x = t => izq + (ancho - izq - 4) * (t - desde) / (ahora - desde)
    const y = v => 6 + (alto - abajo - 6) * (1 - Math.min(v, techo) / techo)

    let trazo = ''
    let area = ''
    let tramo = []
    const cerrarTramo = () => {
      if (tramo.length > 1) {
        trazo += 'M' + tramo.map(p => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('L')
        area += `M${x(tramo[0].t).toFixed(1)},${y(0)}` + tramo.map(p => `L${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('') + `L${x(tramo[tramo.length - 1].t).toFixed(1)},${y(0)}Z`
      }
      tramo = []
    }
    for (const p of puntos) {
      if (tramo.length && p.t - tramo[tramo.length - 1].t > hueco) cerrarTramo()
      tramo.push(p)
    }
    cerrarTramo()

    const marcas = [0, techo / 2, techo]
    const formatoEje = v => (g.unidad === 'GB' ? decimal(v, v < 10 ? 1 : 0) : miles(v))
    const horas = [0, 6, 12, 18, 24].map(h => desde + h * 3600000)
    svg.setAttribute('viewBox', `0 0 ${ancho} ${alto}`)
    svg.innerHTML =
      marcas.map(v => `<line class="${v === 0 ? 'base' : 'cuadricula'}" x1="${izq}" x2="${ancho - 4}" y1="${y(v)}" y2="${y(v)}"/><text x="${izq - 6}" y="${y(v) + 3}" text-anchor="end">${formatoEje(v)}</text>`).join('') +
      horas.map((t, k) => `<text x="${x(t)}" y="${alto - 4}" text-anchor="${k === 0 ? 'start' : k === 4 ? 'end' : 'middle'}">${k === 4 ? 'ahora' : hora(t)}</text>`).join('') +
      (umbral !== null && umbral <= techo ? `<line class="umbral" x1="${izq}" x2="${ancho - 4}" y1="${y(umbral)}" y2="${y(umbral)}"/><text class="umbral-texto" x="${ancho - 6}" y="${y(umbral) - 4}" text-anchor="end">urgente ${g.formato(umbral)}</text>` : '') +
      `<path class="area" d="${area}"/><path class="linea" d="${trazo}"/>` +
      '<line class="cruz" data-cruz y1="6" visibility="hidden"/><circle class="punto" data-punto r="4" visibility="hidden"/>' +
      `<rect data-zona x="${izq}" y="0" width="${ancho - izq}" height="${alto - abajo}" fill="transparent"/>`
    svg.querySelector('[data-cruz]').setAttribute('y2', y(0))
    graficasPintadas.set(i, { svg, puntos, x, y, g })

    // Tabla: un renglón por hora (máximo o mínimo de esa hora, según qué importa más)
    const filas = []
    for (let h = 0; h < 24; h++) {
      const ini = ahora - (h + 1) * 3600000
      const fin = ahora - h * 3600000
      const valores = puntos.filter(p => p.t > ini && p.t <= fin).map(p => p.v)
      if (valores.length) filas.push(`<tr><td>${hora(ini)}–${hora(fin)}</td><td class="derecha">${g.formato(g.resumen === 'min' ? Math.min(...valores) : Math.max(...valores))}</td></tr>`)
    }
    caja.querySelector('[data-tabla]').innerHTML = filas.length
      ? `<table><thead><tr><th>Hora</th><th class="derecha">${g.resumen === 'min' ? 'Mínimo' : 'Máximo'}</th></tr></thead><tbody>${filas.join('')}</tbody></table>`
      : '<div class="vacio">Sin datos</div>'
  })
}

// Cruz y tooltip: el punto más cercano a la posición del mouse (o del dedo)
const moverCursor = evento => {
  const svg = evento.target.closest?.('.grafica svg')
  const tooltip = $('tooltip')
  if (!svg) return
  const i = Number(svg.parentElement.dataset.i)
  const g = graficasPintadas.get(i)
  if (!g || !g.puntos.length) return
  const caja = svg.getBoundingClientRect()
  const px = (evento.touches ? evento.touches[0].clientX : evento.clientX) - caja.left
  let mejor = g.puntos[0]
  for (const p of g.puntos) if (Math.abs(g.x(p.t) - px) < Math.abs(g.x(mejor.t) - px)) mejor = p
  const cx = g.x(mejor.t)
  const cy = g.y(mejor.v)
  const cruz = svg.querySelector('[data-cruz]')
  const punto = svg.querySelector('[data-punto]')
  cruz.setAttribute('x1', cx); cruz.setAttribute('x2', cx); cruz.setAttribute('visibility', 'visible')
  punto.setAttribute('cx', cx); punto.setAttribute('cy', cy); punto.setAttribute('visibility', 'visible')
  tooltip.innerHTML = `${hora(mejor.t)} · <b>${esc(g.g.formato(mejor.v))}</b>`
  tooltip.hidden = false
  const izquierda = Math.min(caja.left + cx + 12, window.innerWidth - tooltip.offsetWidth - 8)
  tooltip.style.left = `${izquierda}px`
  tooltip.style.top = `${caja.top + cy - 30}px`
}
const ocultarCursor = evento => {
  const svg = evento.target.closest?.('.grafica svg')
  if (!svg) return
  svg.querySelector('[data-cruz]')?.setAttribute('visibility', 'hidden')
  svg.querySelector('[data-punto]')?.setAttribute('visibility', 'hidden')
  $('tooltip').hidden = true
}
document.addEventListener('mousemove', moverCursor)
document.addEventListener('touchmove', moverCursor, { passive: true })
document.addEventListener('mouseout', ocultarCursor)

// --- Procesos ---
const pintarProcesos = () => {
  const pm2 = datos.lectura?.pm2
  if (!pm2) return
  if (pm2.error) { $('procesos').innerHTML = `${chip('aviso', 'No se pudo leer PM2')} <span class="apagado">${esc(pm2.error)}</span>`; return }
  const nivelEstado = e => e === 'online' ? 'ok' : e === 'launching' ? 'aviso' : 'urgente'
  $('procesos').innerHTML = `<table>
    <thead><tr><th>Proceso</th><th>Estado</th><th class="derecha">CPU</th><th class="derecha">Memoria</th><th class="derecha">Reinicios</th><th class="derecha">En línea</th></tr></thead>
    <tbody>${pm2.procesos.map(p => `<tr>
      <td class="fuerte">${esc(p.nombre)}</td>
      <td>${chip(nivelEstado(p.estado), p.estado)}</td>
      <td class="derecha numero">${miles(p.cpu)} %</td>
      <td class="derecha numero">${miles(p.memoriaMb)} MB</td>
      <td class="derecha numero">${miles(p.reinicios)}</td>
      <td class="derecha">${p.estado === 'online' && p.desde ? hace(Date.now() - p.desde) : '—'}</td>
    </tr>`).join('')}</tbody></table>`
}

// --- Servicios ---
const fila = (clave, valor) => `<div><dt>${esc(clave)}</dt><dd>${valor}</dd></div>`
const pintarServicios = () => {
  const sv = datos.lectura?.servicios
  if (!sv) return
  const pg = sv.postgres
  const rd = sv.redis
  let html = '<div class="subtitulo">Postgres</div><dl class="datos">'
  if (pg.error) html += fila('Estado', chip('urgente', 'No responde')) + fila('Detalle', esc(pg.error))
  else {
    html += fila('Estado', chip('ok', 'En línea')) +
      fila('Conexiones', `${miles(pg.conexiones)} / ${miles(pg.maximo)}`) +
      fila('Base nodex', `${miles(pg.baseMb)} MB`) +
      fila('Consultas de más de 5 min', pg.lentas ? chip('aviso', miles(pg.lentas)) : '0') +
      fila('Esperando un bloqueo', miles(pg.bloqueadas))
  }
  html += '</dl><div class="subtitulo">Redis</div><dl class="datos">'
  if (rd.error) html += fila('Estado', chip('urgente', 'No responde')) + fila('Detalle', esc(rd.error))
  else {
    html += fila('Estado', chip('ok', 'En línea')) + fila('Memoria', `${miles(rd.memoriaMb)} MB`) + fila('Respuesta', `${miles(rd.ms)} ms`)
    for (const c of rd.colas) {
      html += fila(`Cola ${c.nombre}: en espera`, c.espera >= datos.umbrales.colaEsperaAviso ? chip('aviso', miles(c.espera)) : miles(c.espera)) +
        fila('Activos · demorados', `${miles(c.activos)} · ${miles(c.demorados)}`) +
        fila('Fallidos (guardados)', miles(c.fallidos))
    }
  }
  $('servicios').innerHTML = html + '</dl>'
}

// --- Sitios ---
const pintarSitios = () => {
  const sitios = datos.lectura?.sitios || []
  const u = datos.umbrales
  $('sitios').innerHTML = `<table>
    <thead><tr><th>Sitio</th><th>Estado</th><th class="derecha">Respuesta</th><th>Certificado</th></tr></thead>
    <tbody>${sitios.map(s => {
      const estado = s.error ? chip('urgente', s.error) : chip(s.ms >= u.sitioLentoMs ? 'aviso' : 'ok', `HTTP ${s.codigo}`)
      const c = s.certificado
      const cert = !c ? '<span class="apagado">—</span>' : c.error ? chip('neutro', c.error)
        : `${chip(nivelPor(c.dias, u.certAvisoDias, u.certUrgenteDias, true), `${c.dias} días`)} <span class="apagado">vence ${fecha(c.vence)}</span>`
      return `<tr><td class="fuerte">${esc(new URL(s.url).host)}</td><td>${estado}</td><td class="derecha numero">${miles(s.ms)} ms</td><td>${cert}</td></tr>`
    }).join('')}</tbody></table>`
}

// --- Seguridad ---
const pintarSeguridad = () => {
  const seg = datos.lectura?.seguridad
  const tr = datos.trafico
  if (!seg) return
  let html = '<div class="subtitulo">Accesos</div><dl class="datos">' +
    fila('Intentos SSH fallidos (1 h)', tr.sshFallidos60 >= datos.umbrales.sshFallidos10min ? chip('aviso', miles(tr.sshFallidos60)) : miles(tr.sshFallidos60)) +
    fila('Inicios de sesión fallidos en Nodex (1 h)', miles(tr.loginNodex60)) +
    fila('Claves erradas en el monitor (1 h)', tr.loginMonitor60 ? chip('aviso', miles(tr.loginMonitor60)) : '0') +
    '</dl>'
  if (tr.sshIps60.length) {
    html += '<div class="subtitulo">IPs que más intentan SSH (1 h)</div><table><tbody>' +
      tr.sshIps60.map(x => `<tr><td class="numero">${esc(x.ip)}</td><td class="derecha numero">${miles(x.n)}</td></tr>`).join('') + '</tbody></table>'
  }
  html += '<div class="subtitulo">Puertos abiertos a la red</div>'
  if (seg.puertos?.error) html += `<div class="vacio">${esc(seg.puertos.error)}</div>`
  else {
    html += '<div>' + (seg.puertos?.lista || []).map(p => chip(p.permitido ? 'neutro' : 'aviso', `${p.puerto}/${p.protocolo}`)).join(' ') + '</div>'
  }
  const act = seg.actualizaciones
  const resp = seg.respaldo
  html += '<div class="subtitulo">Sistema</div><dl class="datos">' +
    fila('Actualizaciones pendientes', act ? `${miles(act.total)}${act.seguridad ? ` · ${chip('aviso', `${act.seguridad} de seguridad`)}` : ''}` : '—') +
    fila('Reinicio pendiente', seg.reinicioPendiente ? chip('aviso', 'Sí') : 'No') +
    fila('Último respaldo completo', resp?.error ? chip('neutro', resp.error) : resp?.incompleto ? chip('aviso', 'Incompleto') : resp?.ultimoCompleto ? `${fechaHora(resp.ultimoCompleto)}` : '—') +
    '</dl>'
  $('seguridad').innerHTML = html
}

const pintarTrafico = () => {
  const tr = datos.trafico
  const minutos = 5
  let html = '<dl class="datos">' +
    fila('Peticiones (5 min)', miles(tr.peticiones5)) +
    fila('Errores 5xx (1 h)', tr.errores5xx60 ? chip('aviso', miles(tr.errores5xx60)) : '0') +
    fila('Respuestas 401 / 403 (1 h)', miles(tr.denegadas60)) +
    fila('Sondeos de fallas (1 h)', miles(tr.sondeos60)) +
    '</dl>'
  if (tr.ips5.length) {
    html += `<div class="subtitulo">IPs con más peticiones (5 min)</div><table>
      <thead><tr><th>IP</th><th class="derecha">Peticiones</th><th class="derecha">Por minuto</th></tr></thead><tbody>` +
      tr.ips5.map(x => {
        const porMinuto = x.n / minutos
        const nivel = nivelPor(porMinuto, datos.umbrales.ipPorMinutoAviso, datos.umbrales.ipPorMinutoUrgente)
        return `<tr><td class="numero">${esc(x.ip)}</td><td class="derecha numero">${miles(x.n)}</td><td class="derecha">${nivel === 'ok' ? miles(porMinuto) : chip(nivel, miles(porMinuto))}</td></tr>`
      }).join('') + '</tbody></table>'
  }
  $('trafico').innerHTML = html
}

// --- Eventos e historial ---
const TIPOS = { ssh: 'SSH', sudo: 'sudo', cuenta: 'Cuenta', sondeo: 'Sondeo', monitor: 'Monitor' }
const pintarEventos = () => {
  if (!datos.eventos.length) { $('eventos').innerHTML = '<div class="vacio">Sin eventos</div>'; return }
  const conocida = ip => datos.ipsConocidas.some(c => ip === c || (c.endsWith('.') && ip.startsWith(c)))
  $('eventos').innerHTML = `<table><thead><tr><th>Hora</th><th>Tipo</th><th>Detalle</th><th>IP</th></tr></thead><tbody>${datos.eventos.map(e => {
    const nivel = e.tipo === 'cuenta' ? 'urgente' : e.tipo === 'ssh' ? (conocida(e.ip) ? 'ok' : 'urgente') : e.tipo === 'monitor' ? 'aviso' : 'neutro'
    return `<tr><td>${fechaHora(e.t)}</td><td>${chip(nivel, TIPOS[e.tipo] || e.tipo)}</td><td class="corto">${esc(e.detalle)}</td><td class="numero">${esc(e.ip || '')}</td></tr>`
  }).join('')}</tbody></table>`
}

const pintarHistorial = () => {
  if (!datos.historial.length) { $('historial').innerHTML = '<div class="vacio">Sin alertas</div>'; return }
  // La IP de un acceso SSH viene al inicio del detalle ("192.168.5.1 (password) el …")
  const ipSsh = h => h.titulo.startsWith('Acceso SSH') ? /^([0-9a-f.:]+) /i.exec(h.detalle || '')?.[1] : null
  const conocida = ip => datos.ipsConocidas.some(c => ip === c || (c.endsWith('.') && ip.startsWith(c)))
  // El panel se repinta cada 15 s: los detalles abiertos siguen abiertos
  const abiertos = new Set([...$('historial').querySelectorAll('details[open]')].map(d => d.dataset.clave))
  const clave = h => `${h.desde}|${h.titulo}`
  $('historial').innerHTML = `<table><thead><tr><th>Nivel</th><th>Alerta</th><th>Inicio</th><th class="derecha">Duró</th><th></th></tr></thead><tbody>${datos.historial.map(h => {
    const ip = ipSsh(h)
    return `
    <tr><td>${chip(h.nivel, h.nivel === 'urgente' ? 'Urgente' : 'Aviso')}</td>
    <td class="corto"><details class="detalle" data-clave="${esc(clave(h))}"${abiertos.has(clave(h)) ? ' open' : ''}><summary>${esc(h.titulo)}</summary><div class="detalle-cuerpo">${esc(h.detalle)}
      <div>Inicio: ${fechaHora(h.desde)}${h.evento ? '' : ` · Fin: ${fechaHora(h.hasta)}`}</div></div></details></td>
    <td>${fechaHora(h.desde)}</td>
    <td class="derecha">${h.evento ? 'evento' : hace(h.hasta - h.desde)}</td>
    <td><div class="fila-botones">
      ${ip && !conocida(ip) ? `<button class="boton boton-chico" type="button" data-accion="agregar-ip" data-ip="${esc(ip)}">IP conocida</button>` : ''}
      <button class="boton boton-chico boton-peligro" type="button" data-accion="eliminar-historial" data-desde="${esc(h.desde)}" data-titulo="${esc(h.titulo)}">Eliminar</button>
    </div></td></tr>`
  }).join('')}</tbody></table>`
}

// --- Configuración: lo del .env se ve pero no se quita desde aquí ---
const pintarConfiguracion = () => {
  const aj = datos.ajustes
  if (!aj) return
  // No repintar mientras se escribe en un campo (el panel se refresca cada 15 s)
  if ($('configuracion').contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return
  const lista = (fijos, delPanel, accion, campo) => {
    const soloEnv = fijos.filter(v => !delPanel.includes(v))
    const items = [
      ...soloEnv.map(v => `<span class="ajuste ajuste-fijo" title="Definido en el .env">${esc(v)}</span>`),
      ...delPanel.map(v => `<span class="ajuste">${esc(v)}<button type="button" aria-label="Quitar ${esc(v)}" data-accion="${accion}" data-${campo}="${esc(v)}">×</button></span>`)
    ]
    return `<div class="lista-ajustes">${items.join('') || '<span class="vacio">Ninguna</span>'}</div>`
  }
  $('configuracion').innerHTML = `
    <div>
      <div class="subtitulo">IPs conocidas (SSH)</div>
      ${lista(aj.env.ipsConocidas, aj.panel.ipsConocidas, 'quitar-ip', 'ip')}
      <form class="form-ajuste" data-agregar="agregar-ip"><input name="valor" placeholder="192.168.5.1 o 190.85." maxlength="45" required><button class="boton" type="submit">Agregar</button></form>
    </div>
    <div>
      <div class="subtitulo">Puertos permitidos</div>
      ${lista(aj.env.puertosPermitidos, aj.panel.puertosPermitidos, 'quitar-puerto', 'puerto')}
      <form class="form-ajuste" data-agregar="agregar-puerto"><input name="valor" placeholder="5432" inputmode="numeric" pattern="[0-9]{1,5}" required><button class="boton" type="submit">Agregar</button></form>
    </div>
    <div>
      <div class="subtitulo">Alertas ocultas</div>
      ${aj.ocultas.length ? aj.ocultas.map(o => `<div class="oculta"><span>${esc(o.titulo)}<br><span class="apagado">${fechaHora(o.cuando)} · ${esc(o.usuario || '')}</span></span>
        <button class="boton boton-chico" type="button" data-accion="mostrar" data-id="${esc(o.id)}">Mostrar</button></div>`).join('') : '<div class="vacio">Ninguna</div>'}
    </div>`
}

// --- Ciclo ---
const pintar = () => {
  pintarEstado()
  pintarIndicadores()
  pintarAlertas()
  pintarGraficas()
  pintarProcesos()
  pintarServicios()
  pintarSitios()
  pintarSeguridad()
  pintarTrafico()
  pintarEventos()
  pintarHistorial()
  pintarConfiguracion()
  $('actualizado').textContent = datos.lectura ? `Lectura de las ${hora(datos.lectura.t)}` : ''
}

const cargar = async () => {
  try {
    const respuesta = await fetch('/api/estado', { cache: 'no-store' })
    if (respuesta.status === 401) { location.href = '/ingresar'; return }
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`)
    datos = await respuesta.json()
    pintar()
  } catch (error) {
    $('actualizado').textContent = `Sin conexión con el monitor (${error.message})`
  }
}

let avisoTiempo
const mostrarAviso = texto => {
  const aviso = $('aviso')
  aviso.textContent = texto
  aviso.hidden = false
  clearTimeout(avisoTiempo)
  avisoTiempo = setTimeout(() => { aviso.hidden = true }, 8000)
}

$('probar').addEventListener('click', async evento => {
  const boton = evento.currentTarget
  boton.disabled = true
  try {
    const respuesta = await fetch('/api/prueba', { method: 'POST' })
    const r = await respuesta.json()
    const texto = canal => r[canal]?.error ? `falló (${r[canal].error})` : r[canal]?.omitido ? `no enviado (${r[canal].omitido})` : `enviado a ${r[canal]?.enviado}`
    mostrarAviso(`Correo: ${texto('correo')}. WhatsApp: ${texto('whatsapp')}.`)
  } catch (error) {
    mostrarAviso(`No se pudo probar: ${error.message}`)
  } finally {
    boton.disabled = false
  }
})

// --- Acciones (botones con data-accion y formularios de Configuración) ---
const accion = async (nombre, datosAccion, boton) => {
  if (boton) boton.disabled = true
  try {
    const respuesta = await fetch('/api/accion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: nombre, ...datosAccion }) })
    if (respuesta.status === 401) { location.href = '/ingresar'; return false }
    const r = await respuesta.json().catch(() => ({}))
    if (!respuesta.ok) { mostrarAviso(r.error || `No se pudo (HTTP ${respuesta.status})`); return false }
    await cargar()
    return true
  } catch (error) {
    mostrarAviso(`No se pudo: ${error.message}`)
    return false
  } finally {
    if (boton) boton.disabled = false
  }
}

document.addEventListener('click', evento => {
  const boton = evento.target.closest?.('button[data-accion]')
  if (!boton) return
  const d = boton.dataset
  const nombre = d.accion
  if (nombre === 'ocultar' && !confirm(`¿Ocultar "${d.titulo}"? No volverá a avisar hasta que la muestres de nuevo en Configuración.`)) return
  if (nombre === 'eliminar-historial' && !confirm('¿Eliminar esta alerta del historial?')) return
  const datosAccion = { id: d.id, titulo: d.titulo, puerto: d.puerto, ip: d.ip, desde: d.desde ? Number(d.desde) : undefined }
  accion(nombre, datosAccion, boton)
})

document.addEventListener('submit', async evento => {
  const form = evento.target.closest?.('form[data-agregar]')
  if (!form) return
  evento.preventDefault()
  const valor = form.elements.valor.value.trim()
  if (!valor) return
  const nombre = form.dataset.agregar
  const ok = await accion(nombre, nombre === 'agregar-ip' ? { ip: valor } : { puerto: valor }, form.querySelector('button'))
  if (ok) { form.elements.valor.value = ''; form.elements.valor.blur(); pintarConfiguracion() }
})

let redimension
window.addEventListener('resize', () => { clearTimeout(redimension); redimension = setTimeout(() => datos && pintarGraficas(), 150) })

cargar()
setInterval(cargar, 15000)
