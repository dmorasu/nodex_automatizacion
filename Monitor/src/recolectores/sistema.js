'use strict'
// CPU, RAM, swap, carga y disco. /proc da la RAM "disponible" real (la que mide capacidad-nodex.sh);
// fuera de Linux (pruebas en el Mac) se usa lo que da Node.
const os = require('os')
const fs = require('fs')
const { ejecutar } = require('../utilidades')

let anterior = null

const tiemposCpu = () => os.cpus().reduce((suma, cpu) => {
  const t = cpu.times
  suma.inactivo += t.idle
  suma.total += t.user + t.nice + t.sys + t.idle + t.irq
  return suma
}, { inactivo: 0, total: 0 })

const esperar = ms => new Promise(r => setTimeout(r, ms))

const cpuOcupada = async () => {
  // En la primera lectura no hay con qué comparar: se miden 2 segundos
  if (!anterior) { anterior = tiemposCpu(); await esperar(2000) }
  const actual = tiemposCpu()
  const total = actual.total - anterior.total
  const inactivo = actual.inactivo - anterior.inactivo
  anterior = actual
  return total > 0 ? Math.round(100 * (1 - inactivo / total)) : 0
}

const memoria = () => {
  try {
    const info = fs.readFileSync('/proc/meminfo', 'utf8')
    const valor = clave => Number((info.match(new RegExp(`^${clave}:\\s+(\\d+)`, 'm')) || [])[1] || 0) / 1024
    return {
      totalMb: Math.round(valor('MemTotal')),
      disponibleMb: Math.round(valor('MemAvailable')),
      swapTotalMb: Math.round(valor('SwapTotal')),
      swapUsadaMb: Math.round(valor('SwapTotal') - valor('SwapFree'))
    }
  } catch {
    return {
      totalMb: Math.round(os.totalmem() / 1048576),
      disponibleMb: Math.round(os.freemem() / 1048576),
      swapTotalMb: 0,
      swapUsadaMb: 0
    }
  }
}

const discos = async rutas => {
  const r = await ejecutar('df', ['-P', '-k', ...rutas])
  if (!r.ok && !r.salida) return []
  return r.salida.trim().split('\n').slice(1).map(linea => {
    const c = linea.split(/\s+/)
    return {
      montaje: c[c.length - 1],
      totalGb: +(Number(c[1]) / 1048576).toFixed(1),
      libreGb: +(Number(c[3]) / 1048576).toFixed(1),
      pct: Number(String(c[4]).replace('%', ''))
    }
  })
}

const recolectar = async config => ({
  nombre: os.hostname(),
  cpu: await cpuOcupada(),
  nucleos: os.cpus().length,
  carga: os.loadavg().map(v => +v.toFixed(2)),
  memoria: memoria(),
  discos: await discos(config.discos),
  encendidoDesde: Date.now() - os.uptime() * 1000
})

module.exports = { recolectar }
