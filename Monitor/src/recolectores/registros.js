'use strict'
// Lee solo lo nuevo de los logs de Nginx y de auth.log en cada ciclo (como tail -f).
// Al arrancar empieza por el final: lo viejo ya pasó y no debe disparar avisos de nuevo.
const fs = require('fs')

const MAXIMO_POR_LECTURA = 20 * 1024 * 1024

class Seguidor {
  constructor (ruta) {
    this.ruta = ruta
    this.posicion = null
    this.inodo = null
    this.resto = ''
  }

  lineasNuevas () {
    const info = fs.statSync(this.ruta)
    if (this.posicion === null) { this.posicion = info.size; this.inodo = info.ino; return [] }
    // logrotate cambió el archivo (otro inodo) o lo vació: se lee desde el comienzo
    if (info.ino !== this.inodo || info.size < this.posicion) { this.posicion = 0; this.inodo = info.ino; this.resto = '' }
    if (info.size === this.posicion) return []
    if (info.size - this.posicion > MAXIMO_POR_LECTURA) this.posicion = info.size - MAXIMO_POR_LECTURA

    const largo = info.size - this.posicion
    const buffer = Buffer.alloc(largo)
    const fd = fs.openSync(this.ruta, 'r')
    try { fs.readSync(fd, buffer, 0, largo, this.posicion) } finally { fs.closeSync(fd) }
    this.posicion = info.size

    const lineas = (this.resto + buffer.toString('utf8')).split('\n')
    this.resto = lineas.pop()
    return lineas
  }
}

const seguidores = new Map()
const leer = ruta => {
  if (!seguidores.has(ruta)) seguidores.set(ruta, new Seguidor(ruta))
  return seguidores.get(ruta).lineasNuevas()
}

// --- Nginx (formato combined) ---------------------------------------------
const LINEA_NGINX = /^(\S+) \S+ \S+ \[[^\]]+\] "(\S+) (\S+)[^"]*" (\d{3}) /
// Rutas que solo pide quien busca fallas: Nodex no tiene PHP, WordPress ni .env públicos
const SONDEO = /\/\.(env|git|aws|ssh|htpasswd)|wp-(login|admin|content|includes)|phpmyadmin|\.php(\?|$)|cgi-bin|\/actuator|\/server-status|\/\.well-known\/security\.txt\.bak/i

const analizarNginx = rutas => {
  const r = { total: 0, s5xx: 0, s4xx: 0, denegadas: 0, porIp: {}, sondeos: 0, ejemplosSondeo: [], errores: [] }
  for (const ruta of rutas) {
    let lineas
    try { lineas = leer(ruta) } catch (error) { r.errores.push(`${ruta}: ${error.code || error.message}`); continue }
    for (const linea of lineas) {
      const m = linea.match(LINEA_NGINX)
      if (!m) continue
      const [, ip, , camino, codigoTexto] = m
      const codigo = Number(codigoTexto)
      r.total++
      r.porIp[ip] = (r.porIp[ip] || 0) + 1
      if (codigo >= 500) r.s5xx++
      else if (codigo >= 400) r.s4xx++
      if (codigo === 401 || codigo === 403) r.denegadas++
      if (SONDEO.test(camino)) {
        r.sondeos++
        if (r.ejemplosSondeo.length < 5) r.ejemplosSondeo.push({ ip, camino: camino.slice(0, 120) })
      }
    }
  }
  return r
}

// --- auth.log ------------------------------------------------------------
const SSH_FALLIDO = /sshd\[\d+\]: (?:Invalid user (\S*) from (\S+)|Failed (?:password|publickey) for (?!invalid user)(\S+) from (\S+))/
const SSH_ACEPTADO = /sshd\[\d+\]: Accepted (\S+) for (\S+) from (\S+)/
const SUDO = /sudo(?:\[\d+\])?:\s+(\S+) : .*COMMAND=(.*)$/
const SUDO_FALLIDO = /sudo(?:\[\d+\])?:.*(?:authentication failure|incorrect password attempts?)/
const USUARIO_NUEVO = /useradd\[\d+\]: new user: name=([^,\s]+)/
const GRUPO_ADMIN = /usermod\[\d+\]: add '([^']+)' to (?:shadow )?group '(sudo|adm|root|admin)'/
const CLAVE_CAMBIADA = /passwd\[\d+\]: pam_unix\(passwd:chauthtok\): password changed for (\S+)/

const analizarAuth = (ruta, usuarioSistema) => {
  const r = { fallidos: 0, fallidosPorIp: {}, accesos: [], sudo: [], sudoFallidos: 0, cuentas: [], error: null }
  let lineas
  try { lineas = leer(ruta) } catch (error) { r.error = `${ruta}: ${error.code || error.message}`; return r }
  for (const linea of lineas) {
    let m
    if ((m = linea.match(SSH_FALLIDO))) {
      const ip = m[2] || m[4]
      r.fallidos++
      r.fallidosPorIp[ip] = (r.fallidosPorIp[ip] || 0) + 1
    } else if ((m = linea.match(SSH_ACEPTADO))) {
      r.accesos.push({ metodo: m[1], usuario: m[2], ip: m[3] })
    } else if ((m = linea.match(SUDO))) {
      if (m[1] !== usuarioSistema) r.sudo.push({ usuario: m[1], comando: m[2].trim().slice(0, 160) })
    } else if (SUDO_FALLIDO.test(linea)) {
      if (!linea.includes(`user=${usuarioSistema}`) && !linea.includes(`ruser=${usuarioSistema}`)) r.sudoFallidos++
    } else if ((m = linea.match(USUARIO_NUEVO))) {
      r.cuentas.push(`Se creó el usuario del sistema "${m[1]}"`)
    } else if ((m = linea.match(GRUPO_ADMIN))) {
      r.cuentas.push(`El usuario "${m[1]}" entró al grupo ${m[2]}`)
    } else if ((m = linea.match(CLAVE_CAMBIADA))) {
      r.cuentas.push(`Se cambió la contraseña de "${m[1]}"`)
    }
  }
  return r
}

const recolectar = config => ({
  nginx: analizarNginx(config.logsNginx),
  auth: analizarAuth(config.logAuth, config.usuarioSistema)
})

module.exports = { recolectar }
