'use strict'
// Panel web. Escucha solo en 127.0.0.1: desde internet se llega únicamente por Nginx con HTTPS.
const http = require('http')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const PUBLICO = path.join(__dirname, '..', 'public')
const ESTATICOS = {
  '/panel.css': 'text/css; charset=utf-8',
  '/panel.js': 'text/javascript; charset=utf-8',
  '/icono.svg': 'image/svg+xml'
}
const COOKIE = '__Host-monitor'

const ENCABEZADOS = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow'
}

const crearServidor = (config, obtenerEstado, alIntentoFallido, enviarPrueba) => {
  const sesiones = new Map()
  // Intentos fallidos por IP: 5 en 15 min y la IP queda bloqueada hasta que pasen los 15 min
  const fallidos = new Map()

  const nombreCookie = config.cookieSegura ? COOKIE : 'monitor'
  const ipDe = req => String(req.headers['x-real-ip'] || req.socket.remoteAddress || '')

  const leerSesion = req => {
    const cookies = Object.fromEntries(String(req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(c => c.length === 2))
    const token = cookies[nombreCookie]
    const sesion = token && sesiones.get(token)
    if (!sesion) return null
    if (sesion.expira < Date.now()) { sesiones.delete(token); return null }
    return { token, ...sesion }
  }

  const responder = (res, codigo, cuerpo, tipo = 'application/json; charset=utf-8', extra = {}) => {
    res.writeHead(codigo, { ...ENCABEZADOS, 'Content-Type': tipo, ...extra })
    res.end(typeof cuerpo === 'string' || Buffer.isBuffer(cuerpo) ? cuerpo : JSON.stringify(cuerpo))
  }
  const redirigir = (res, destino, extra = {}) => { res.writeHead(303, { ...ENCABEZADOS, Location: destino, ...extra }); res.end() }

  const leerCuerpo = req => new Promise((resolver, rechazar) => {
    let datos = ''
    req.on('data', parte => {
      datos += parte
      if (datos.length > 4096) { rechazar(new Error('cuerpo muy grande')); req.destroy() }
    })
    req.on('end', () => resolver(datos))
    req.on('error', rechazar)
  })

  // Comparar siempre todo el valor, para que el tiempo de respuesta no delate cuánto acertó
  const iguales = (a, b) => crypto.timingSafeEqual(crypto.createHash('sha256').update(a).digest(), crypto.createHash('sha256').update(b).digest())
  const claveCorrecta = clave => {
    const [tipo, sal, hash] = config.claveHash.split('$')
    if (tipo !== 'scrypt' || !sal || !hash) return false
    const calculado = crypto.scryptSync(clave, Buffer.from(sal, 'hex'), 64)
    return crypto.timingSafeEqual(calculado, Buffer.from(hash, 'hex'))
  }

  const bloqueada = ip => {
    const registro = fallidos.get(ip)
    if (!registro) return false
    if (Date.now() - registro.desde > 15 * 60000) { fallidos.delete(ip); return false }
    return registro.n >= 5
  }

  const paginaIngreso = error => {
    const html = fs.readFileSync(path.join(PUBLICO, 'ingresar.html'), 'utf8')
    return html.replace('<!--error-->', error ? `<p class="error-ingreso" role="alert">${error}</p>` : '')
  }

  // Un POST desde otro sitio no puede usar la sesión (SameSite=Strict); se revisa Origin igual
  const mismoOrigen = req => {
    const origen = req.headers.origin
    if (!origen) return true
    const host = req.headers['x-forwarded-host'] || req.headers.host
    try { return new URL(origen).host === host } catch { return false }
  }

  // Limpieza de sesiones vencidas
  setInterval(() => { for (const [t, s] of sesiones) if (s.expira < Date.now()) sesiones.delete(t) }, 3600000).unref()

  const servidor = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://local')
      const ruta = url.pathname

      if (req.method === 'GET' && ESTATICOS[ruta]) {
        return responder(res, 200, fs.readFileSync(path.join(PUBLICO, ruta.slice(1))), ESTATICOS[ruta], { 'Cache-Control': 'public, max-age=300' })
      }

      if (ruta === '/ingresar' && req.method === 'GET') return responder(res, 200, paginaIngreso(), 'text/html; charset=utf-8')

      if (ruta === '/ingresar' && req.method === 'POST') {
        const ip = ipDe(req)
        if (!mismoOrigen(req)) return responder(res, 403, paginaIngreso('Solicitud no válida.'), 'text/html; charset=utf-8')
        if (bloqueada(ip)) return responder(res, 429, paginaIngreso('Demasiados intentos. Espera 15 minutos.'), 'text/html; charset=utf-8')
        const datos = new URLSearchParams(await leerCuerpo(req))
        const usuario = datos.get('usuario') || ''
        const clave = datos.get('clave') || ''
        const correcto = Boolean(config.usuario && config.claveHash) && iguales(usuario, config.usuario) && claveCorrecta(clave)
        if (!correcto) {
          const registro = fallidos.get(ip) || { n: 0, desde: Date.now() }
          registro.n++
          fallidos.set(ip, registro)
          alIntentoFallido(ip, usuario)
          return responder(res, 401, paginaIngreso('Usuario o contraseña incorrectos.'), 'text/html; charset=utf-8')
        }
        fallidos.delete(ip)
        const token = crypto.randomBytes(32).toString('base64url')
        sesiones.set(token, { usuario, expira: Date.now() + config.horasSesion * 3600000, ip })
        const cookie = `${nombreCookie}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${config.horasSesion * 3600}${config.cookieSegura ? '; Secure' : ''}`
        return redirigir(res, '/', { 'Set-Cookie': cookie })
      }

      const sesion = leerSesion(req)

      if (ruta === '/salir' && req.method === 'POST') {
        if (sesion) sesiones.delete(sesion.token)
        return redirigir(res, '/ingresar', { 'Set-Cookie': `${nombreCookie}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${config.cookieSegura ? '; Secure' : ''}` })
      }

      if (!sesion) {
        if (ruta.startsWith('/api/')) return responder(res, 401, { error: 'sesión vencida' })
        return redirigir(res, '/ingresar')
      }

      if (ruta === '/' && req.method === 'GET') return responder(res, 200, fs.readFileSync(path.join(PUBLICO, 'index.html')), 'text/html; charset=utf-8')
      if (ruta === '/api/estado' && req.method === 'GET') return responder(res, 200, obtenerEstado())
      if (ruta === '/api/prueba' && req.method === 'POST') {
        if (!mismoOrigen(req)) return responder(res, 403, { error: 'origen no permitido' })
        return responder(res, 200, await enviarPrueba(sesion.usuario))
      }

      return responder(res, 404, { error: 'no existe' })
    } catch (error) {
      console.error('[web]', error.message)
      if (!res.headersSent) responder(res, 500, { error: 'error interno' })
    }
  })

  servidor.listen(config.puerto, '127.0.0.1', () => console.log(`Panel en http://127.0.0.1:${config.puerto}`))
  return servidor
}

module.exports = { crearServidor }
