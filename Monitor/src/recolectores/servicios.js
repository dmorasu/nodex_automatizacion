'use strict'
// Postgres (por el envoltorio nodex-monitor-pg, como el usuario postgres: sin contraseña en el monitor)
// y Redis con la cola de BullMQ (protocolo de Redis a mano, para no instalar dependencias).
const net = require('net')
const { ejecutar } = require('../utilidades')

const postgres = async config => {
  const [comando, ...args] = config.cmdPostgres
  const r = await ejecutar(comando, args, 15000)
  if (!r.ok) return { error: r.error || 'sin respuesta' }
  const [conexiones, maximo, baseMb, lentas, bloqueadas] = r.salida.trim().split('|').map(Number)
  if (!Number.isFinite(maximo)) return { error: `respuesta inesperada: ${r.salida.slice(0, 80)}` }
  return { conexiones, maximo, baseMb, lentas, bloqueadas }
}

// --- Redis ---------------------------------------------------------------
const codificar = partes => `*${partes.length}\r\n` + partes.map(p => `$${Buffer.byteLength(String(p))}\r\n${p}\r\n`).join('')

// Devuelve [valor, siguientePosicion] o null si la respuesta aún no llegó completa
const leerRespuesta = (buffer, pos) => {
  const fin = buffer.indexOf('\r\n', pos)
  if (fin < 0) return null
  const tipo = String.fromCharCode(buffer[pos])
  const linea = buffer.toString('utf8', pos + 1, fin)
  if (tipo === '+') return [linea, fin + 2]
  if (tipo === '-') return [new Error(linea), fin + 2]
  if (tipo === ':') return [Number(linea), fin + 2]
  if (tipo === '$') {
    const largo = Number(linea)
    if (largo < 0) return [null, fin + 2]
    if (buffer.length < fin + 2 + largo + 2) return null
    return [buffer.toString('utf8', fin + 2, fin + 2 + largo), fin + 2 + largo + 2]
  }
  return [new Error('respuesta de Redis no reconocida'), buffer.length]
}

const comandosRedis = (opciones, comandos) => new Promise((resolver, rechazar) => {
  const socket = net.createConnection({ host: opciones.host, port: opciones.puerto })
  let buffer = Buffer.alloc(0)
  const respuestas = []
  let pos = 0
  socket.setTimeout(5000, () => { socket.destroy(); rechazar(new Error('Redis no respondió en 5 s')) })
  socket.on('error', rechazar)
  socket.on('connect', () => socket.write(comandos.map(codificar).join('')))
  socket.on('data', datos => {
    buffer = Buffer.concat([buffer, datos])
    let leida
    while (respuestas.length < comandos.length && (leida = leerRespuesta(buffer, pos))) {
      respuestas.push(leida[0])
      pos = leida[1]
    }
    if (respuestas.length === comandos.length) { socket.end(); resolver(respuestas) }
  })
})

const redis = async config => {
  const { redis: opciones, colas } = config
  const comandos = []
  if (opciones.clave) comandos.push(['AUTH', opciones.clave])
  comandos.push(['SELECT', opciones.db], ['PING'], ['INFO', 'memory'])
  for (const cola of colas) {
    comandos.push(['LLEN', `bull:${cola}:wait`], ['LLEN', `bull:${cola}:active`],
      ['ZCARD', `bull:${cola}:failed`], ['ZCARD', `bull:${cola}:delayed`])
  }
  const inicio = Date.now()
  const respuestas = await comandosRedis(opciones, comandos)
  const error = respuestas.find(r => r instanceof Error)
  if (error) return { error: error.message }

  const base = opciones.clave ? 1 : 0
  const info = String(respuestas[base + 2] || '')
  const memoriaMb = Math.round(Number((info.match(/used_memory:(\d+)/) || [])[1] || 0) / 1048576)
  const resultadoColas = colas.map((nombre, i) => {
    const [espera, activos, fallidos, demorados] = respuestas.slice(base + 3 + i * 4, base + 7 + i * 4)
    return { nombre, espera, activos, fallidos, demorados }
  })
  return { ms: Date.now() - inicio, memoriaMb, colas: resultadoColas }
}

const recolectar = async config => {
  const [pg, rd] = await Promise.allSettled([postgres(config), redis(config)])
  return {
    postgres: pg.status === 'fulfilled' ? pg.value : { error: pg.reason.message },
    redis: rd.status === 'fulfilled' ? rd.value : { error: rd.reason.message }
  }
}

module.exports = { recolectar }
