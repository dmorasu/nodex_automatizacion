'use strict'
const { execFile } = require('child_process')

// execFile (sin shell): ningún dato leído de los logs llega a una línea de comandos
const ejecutar = (comando, args = [], milisegundos = 15000) => new Promise(resolver => {
  execFile(comando, args, { timeout: milisegundos, maxBuffer: 10 * 1024 * 1024 }, (error, salida, errores) => {
    resolver({
      ok: !error,
      salida: String(salida || ''),
      error: error ? (String(errores || '').trim().split('\n').pop() || error.message) : null
    })
  })
})

// Un recolector que falla no debe tumbar el ciclo: devuelve { error } y el panel lo muestra
const seguro = async (nombre, funcion) => {
  try {
    return await funcion()
  } catch (error) {
    console.error(`[${nombre}]`, error.message)
    return { error: error.message }
  }
}

const formatoHora = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
})
const fechaHora = t => formatoHora.format(new Date(t))

const duracion = ms => {
  const minutos = Math.round(ms / 60000)
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 48) return `${horas} h ${minutos % 60} min`
  return `${Math.floor(horas / 24)} días`
}

module.exports = { ejecutar, seguro, fechaHora, duracion }
