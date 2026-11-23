'use strict'
// Correo (SendGrid) y WhatsApp (Twilio) por sus API HTTP, sin pasar por el backend de Nodex:
// si el backend se cae, el monitor igual tiene que poder avisar.

const escapar = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const enviarCorreo = async (config, asunto, lineas) => {
  if (!config.sendgridClave || !config.correoDe || !config.correos.length) return { omitido: 'faltan SENDGRID_API_KEY, EMAIL_FROM o MONITOR_CORREOS' }
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1e293b">${lineas.map(l => `<p style="margin:0 0 8px">${escapar(l)}</p>`).join('')}<p style="margin-top:16px;color:#94a3b8;font-size:12px">Nodex Monitor · https://monitor.nodexgpa.com</p></div>`
  const respuesta = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.sendgridClave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: config.correos.map(email => ({ email })) }],
      from: { email: config.correoDe, name: 'Nodex Monitor' },
      subject: asunto,
      content: [{ type: 'text/plain', value: lineas.join('\n') }, { type: 'text/html', value: html }]
    }),
    signal: AbortSignal.timeout(15000)
  })
  if (!respuesta.ok) throw new Error(`SendGrid ${respuesta.status}: ${(await respuesta.text()).slice(0, 200)}`)
  return { enviado: config.correos.length }
}

const conPrefijo = numero => numero.startsWith('whatsapp:') ? numero : `whatsapp:${numero}`

const enviarWhatsapp = async (config, texto) => {
  const { sid, token, desde, plantilla } = config.twilio
  if (!sid || !token || !desde || !config.whatsapp.length) return { omitido: 'faltan TWILIO_* o MONITOR_WHATSAPP' }
  const autorizacion = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64')
  const resultados = []
  for (const numero of config.whatsapp) {
    const cuerpo = new URLSearchParams({ From: conPrefijo(desde), To: conPrefijo(numero) })
    if (plantilla) {
      // WhatsApp no acepta saltos de línea ni textos muy largos dentro de una variable
      cuerpo.set('ContentSid', plantilla)
      cuerpo.set('ContentVariables', JSON.stringify({ 1: texto.replace(/\s*\n+\s*/g, ' · ').slice(0, 900) }))
    } else {
      cuerpo.set('Body', texto.slice(0, 1500))
    }
    const respuesta = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: autorizacion, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: cuerpo,
      signal: AbortSignal.timeout(15000)
    })
    if (!respuesta.ok) throw new Error(`Twilio ${respuesta.status}: ${(await respuesta.text()).slice(0, 200)}`)
    resultados.push(numero)
  }
  return { enviado: resultados.length }
}

// Con MONITOR_NOTIFICAR=no (pruebas) solo se escribe en consola lo que se habría mandado
const crearNotificador = config => ({
  correo: async (asunto, lineas) => {
    if (!config.notificar) { console.log(`[correo sin enviar] ${asunto}\n  ${lineas.join('\n  ')}`); return { omitido: 'MONITOR_NOTIFICAR=no' } }
    return enviarCorreo(config, asunto, lineas)
  },
  whatsapp: async texto => {
    if (!config.notificar) { console.log(`[whatsapp sin enviar] ${texto}`); return { omitido: 'MONITOR_NOTIFICAR=no' } }
    return enviarWhatsapp(config, texto)
  }
})

module.exports = { crearNotificador }
