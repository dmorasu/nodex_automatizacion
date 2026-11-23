'use strict'
// Procesos de PM2 y logins fallidos de Nodex. Los da el envoltorio nodex-monitor-pm2, que corre
// como desarrolloti y quita las variables de entorno (llevan las claves) antes de entregarlos.
const { ejecutar } = require('../utilidades')

// El envoltorio cuenta los 401/429 del login en el log del backend; aquí se saca cuántos son nuevos.
// Si el número baja es que pm2-logrotate rotó el archivo: todo lo que hay es nuevo.
let loginAnterior = null

const recolectar = async config => {
  const [comando, ...args] = config.cmdPm2
  const r = await ejecutar(comando, args, 20000)
  if (!r.ok) return { error: r.error || 'sin respuesta', procesos: [], loginFallidosNuevos: 0 }

  const datos = JSON.parse(r.salida)
  const procesos = (datos.procesos || []).filter(p => !config.procesosIgnorar.includes(p.nombre))

  let loginFallidosNuevos = 0
  if (Number.isFinite(datos.loginFallidos)) {
    if (loginAnterior !== null) {
      loginFallidosNuevos = datos.loginFallidos >= loginAnterior ? datos.loginFallidos - loginAnterior : datos.loginFallidos
    }
    loginAnterior = datos.loginFallidos
  }
  return { procesos, loginFallidosNuevos }
}

module.exports = { recolectar }
