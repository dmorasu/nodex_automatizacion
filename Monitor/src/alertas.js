'use strict'
// Lleva las alertas activas y decide qué se manda. Todo lo de un ciclo va en un solo mensaje
// por canal (diez IPs atacando a la vez no son diez WhatsApp).
const { fechaHora, duracion } = require('./utilidades')

const MAX_HISTORIAL = 300
const whatsappEnviados = []
const icono = nivel => nivel === 'urgente' ? '🔴' : '🟠'

const procesar = async (condiciones, eventos, estado, config, notificador) => {
  const ahora = Date.now()
  const nuevas = []
  const repetidas = []
  const resueltas = []
  const vigentes = new Set()

  for (const c of condiciones) {
    if (vigentes.has(c.id)) continue
    vigentes.add(c.id)
    const activa = estado.activas[c.id]
    if (!activa) {
      estado.activas[c.id] = { ...c, desde: ahora, notificada: ahora, maximo: c.nivel }
      nuevas.push(c)
      continue
    }
    const subio = activa.nivel === 'aviso' && c.nivel === 'urgente'
    Object.assign(activa, { nivel: c.nivel, titulo: c.titulo, detalle: c.detalle })
    if (c.nivel === 'urgente') activa.maximo = 'urgente'
    if (subio) { activa.notificada = ahora; nuevas.push(c) } else if (c.nivel === 'urgente' && ahora - activa.notificada >= config.repetirUrgenteMin * 60000) {
      activa.notificada = ahora
      repetidas.push({ ...c, desde: activa.desde })
    }
  }

  for (const [id, activa] of Object.entries(estado.activas)) {
    if (vigentes.has(id)) continue
    delete estado.activas[id]
    resueltas.push(activa)
    estado.historial.unshift({ id, nivel: activa.maximo || activa.nivel, titulo: activa.titulo, detalle: activa.detalle, desde: activa.desde, hasta: ahora })
  }
  for (const e of eventos) {
    estado.historial.unshift({ id: 'evento', nivel: e.nivel, titulo: e.titulo, detalle: e.detalle, desde: ahora, hasta: ahora, evento: true })
  }
  estado.historial.length = Math.min(estado.historial.length, MAX_HISTORIAL)

  const avisar = [...nuevas, ...eventos]
  if (!avisar.length && !repetidas.length && !resueltas.length) return

  const linea = c => `${icono(c.nivel)} ${c.titulo}${c.detalle ? `. ${c.detalle}` : ''}`
  const lineaRepetida = c => `🔁 Sigue (desde hace ${duracion(ahora - c.desde)}): ${c.titulo}`
  const lineaResuelta = a => `✅ Resuelto: ${a.titulo} (duró ${duracion(ahora - a.desde)})`

  // Correo: todo
  const urgentes = avisar.filter(c => c.nivel === 'urgente').length
  const avisos = avisar.length - urgentes
  const partesAsunto = []
  if (urgentes) partesAsunto.push(`🔴 ${urgentes} urgente${urgentes > 1 ? 's' : ''}`)
  if (avisos) partesAsunto.push(`🟠 ${avisos} aviso${avisos > 1 ? 's' : ''}`)
  if (repetidas.length) partesAsunto.push(`🔁 ${repetidas.length} sigue${repetidas.length > 1 ? 'n' : ''}`)
  if (resueltas.length) partesAsunto.push(`✅ ${resueltas.length} resuelto${resueltas.length > 1 ? 's' : ''}`)
  const lineasCorreo = [
    ...avisar.filter(c => c.nivel === 'urgente').map(linea),
    ...avisar.filter(c => c.nivel !== 'urgente').map(linea),
    ...repetidas.map(lineaRepetida),
    ...resueltas.map(lineaResuelta),
    `Servidor ${estado.nombreServidor || ''} · ${fechaHora(ahora)}`
  ]

  // WhatsApp: solo lo urgente (y su resolución, para saber que ya se puede dejar de mirar)
  const lineasWhatsapp = [
    ...avisar.filter(c => c.nivel === 'urgente').map(linea),
    ...repetidas.map(lineaRepetida),
    ...resueltas.filter(a => a.maximo === 'urgente').map(lineaResuelta)
  ]

  let notaWhatsapp = null
  if (lineasWhatsapp.length) {
    while (whatsappEnviados.length && ahora - whatsappEnviados[0] > 3600000) whatsappEnviados.shift()
    if (whatsappEnviados.length >= config.maxWhatsappHora) {
      notaWhatsapp = `(No se mandó WhatsApp: ya van ${config.maxWhatsappHora} en la última hora)`
    } else {
      whatsappEnviados.push(ahora)
      try {
        await notificador.whatsapp(`⚠️ Nodex servidor\n${lineasWhatsapp.join('\n')}`)
      } catch (error) {
        notaWhatsapp = `(El WhatsApp falló: ${error.message})`
        console.error('[whatsapp]', error.message)
      }
    }
  }

  try {
    await notificador.correo(`[Nodex servidor] ${partesAsunto.join(' · ')}`, notaWhatsapp ? [...lineasCorreo, notaWhatsapp] : lineasCorreo)
  } catch (error) {
    console.error('[correo]', error.message)
  }
}

module.exports = { procesar }
