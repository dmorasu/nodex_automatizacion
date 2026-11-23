'use strict'
// Puertos expuestos, actualizaciones del sistema y el respaldo diario (respaldo-nodex.sh).
const fs = require('fs')
const { ejecutar } = require('../utilidades')

const esLocal = host => /^(127\.|\[?::1\]?$|\[?::ffff:127\.)/.test(host) || host.includes('%lo')

const puertos = async config => {
  const r = await ejecutar('ss', ['-H', '-ltnu'])
  if (!r.ok) return { error: r.error }
  const vistos = new Map()
  for (const linea of r.salida.trim().split('\n')) {
    const c = linea.trim().split(/\s+/)
    if (c.length < 5) continue
    const local = c[4]
    const corte = local.lastIndexOf(':')
    const host = local.slice(0, corte)
    const puerto = Number(local.slice(corte + 1))
    if (!puerto || esLocal(host)) continue
    const clave = `${c[0]}/${puerto}`
    if (!vistos.has(clave)) vistos.set(clave, { protocolo: c[0], puerto, direccion: host, permitido: config.puertosPermitidos.includes(puerto) })
  }
  return { lista: [...vistos.values()].sort((a, b) => a.puerto - b.puerto) }
}

const actualizaciones = () => {
  let texto = ''
  try { texto = fs.readFileSync('/var/lib/update-notifier/updates-available', 'utf8') } catch { return null }
  const total = Number((texto.match(/(\d+)\s+(?:updates|packages)\s+can be/) || [])[1] || 0)
  const seguridad = Number((texto.match(/(\d+)\s+(?:of these updates are|updates are)\s+(?:standard\s+)?security/) || [])[1] || 0)
  return { total, seguridad }
}

const reinicioPendiente = () => fs.existsSync('/var/run/reboot-required')

// Las líneas del log empiezan con "2026-11-22 02:31:10"; la última de resultado dice cómo terminó
const respaldo = config => {
  let texto
  try {
    const info = fs.statSync(config.logRespaldo)
    const fd = fs.openSync(config.logRespaldo, 'r')
    const largo = Math.min(info.size, 64 * 1024)
    const buffer = Buffer.alloc(largo)
    fs.readSync(fd, buffer, 0, largo, info.size - largo)
    fs.closeSync(fd)
    texto = buffer.toString('utf8')
  } catch (error) {
    return { error: error.code || error.message }
  }
  const lineas = texto.trim().split('\n')
  const fecha = linea => new Date(`${linea.slice(0, 10)}T${linea.slice(11, 19)}-05:00`).getTime()
  const ultimoCompleto = [...lineas].reverse().find(l => l.includes('Respaldo completo'))
  const ultimoResultado = [...lineas].reverse().find(l => l.includes('Respaldo completo') || l.includes('RESPALDO INCOMPLETO'))
  return {
    ultimoCompleto: ultimoCompleto ? fecha(ultimoCompleto) : null,
    incompleto: ultimoResultado?.includes('RESPALDO INCOMPLETO') ? ultimoResultado.slice(20).replace(/^\W+/, '') : null
  }
}

const recolectar = async config => ({
  puertos: await puertos(config),
  actualizaciones: actualizaciones(),
  reinicioPendiente: reinicioPendiente(),
  respaldo: respaldo(config)
})

module.exports = { recolectar }
