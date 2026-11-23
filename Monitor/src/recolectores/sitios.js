'use strict'
// Los dominios públicos tal como los ve un usuario (Nginx + HTTPS + app) y el vencimiento del certificado.
const tls = require('tls')

const revisarSitio = async url => {
  const inicio = Date.now()
  try {
    // Sin seguir redirecciones: las apps mandan a /auth/login y eso ya es "arriba"
    const respuesta = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'nodex-monitor' } })
    await respuesta.body?.cancel()
    return { url, codigo: respuesta.status, ms: Date.now() - inicio, error: respuesta.status >= 500 ? `HTTP ${respuesta.status}` : null }
  } catch (error) {
    const detalle = error.name === 'TimeoutError' ? 'no respondió en 10 s' : (error.cause?.code || error.message)
    return { url, codigo: null, ms: Date.now() - inicio, error: detalle }
  }
}

const diasCertificado = host => new Promise(resolver => {
  const socket = tls.connect({ host, port: 443, servername: host, timeout: 8000 }, () => {
    const vence = socket.getPeerCertificate()?.valid_to
    socket.end()
    resolver(vence ? { vence: new Date(vence).getTime(), dias: Math.floor((new Date(vence) - Date.now()) / 86400000) } : { error: 'sin certificado' })
  })
  socket.on('timeout', () => { socket.destroy(); resolver({ error: 'sin respuesta' }) })
  socket.on('error', error => resolver({ error: error.code || error.message }))
})

// El certificado cambia cada 60-90 días: basta con mirarlo cada 6 horas
const certificados = new Map()
const SEIS_HORAS = 6 * 3600 * 1000

const recolectar = async config => Promise.all(config.sitios.map(async url => {
  const sitio = await revisarSitio(url)
  const { protocol, hostname } = new URL(url)
  if (protocol === 'https:') {
    const guardado = certificados.get(hostname)
    if (!guardado || Date.now() - guardado.leido > SEIS_HORAS || guardado.error) {
      certificados.set(hostname, { ...(await diasCertificado(hostname)), leido: Date.now() })
    }
    const cert = certificados.get(hostname)
    sitio.certificado = cert.error ? { error: cert.error } : { dias: Math.floor((cert.vence - Date.now()) / 86400000), vence: cert.vence }
  }
  return sitio
}))

module.exports = { recolectar }
