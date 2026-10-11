import sgMail from '@sendgrid/mail'
import { correoEnsayo, modoEnsayo } from '../utils/modoEnsayo'
import { obtenerArchivo } from './azureFileStorage'

sgMail.setApiKey(process.env.SENDGRID_API_KEY!)

// Archivo de Azure File Share que va adjunto al correo (en la cola solo viaja la ruta)
export type AdjuntoCorreo = { rutaDirectorio: string, nombreArchivo: string, nombre: string, tipo: string }

// Los XML de la DIAN suelen llegar sin tipo o como text/xml: se adjuntan como application/xml
const tipoAdjunto = (adjunto: AdjuntoCorreo) =>
  /\.xml$/i.test(adjunto.nombre) ? 'application/xml' : adjunto.tipo || 'application/octet-stream'

const descargarAdjuntos = async (adjuntos?: AdjuntoCorreo[]) => {
  if (!adjuntos?.length) return undefined
  return Promise.all(adjuntos.map(async adjunto => ({
    content: (await obtenerArchivo(adjunto.rutaDirectorio, adjunto.nombreArchivo)).toString('base64'),
    filename: adjunto.nombre,
    type: tipoAdjunto(adjunto),
    disposition: 'attachment'
  })))
}

export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  cc?: string[],
  // Los correos de trámites van con copia a la torre de control; los de gastos no
  ccTorreControl = true,
  adjuntos?: AdjuntoCorreo[]
) => {
  try {

    // Si un adjunto no se puede descargar, el correo falla (y se reintenta) en vez de salir sin él
    const attachments = await descargarAdjuntos(adjuntos)

    // Modo ensayo: todo va solo al correo de pruebas, sin copias; sin él, no sale nada
    if (modoEnsayo()) {
      const destino = correoEnsayo()
      if (!destino) {
        console.log(`🧪 MODO ENSAYO: correo NO enviado (falta CORREO_ENSAYO) · para ${to} · "${subject}"`)
        return
      }
      console.log(`🧪 MODO ENSAYO: correo para ${to}${cc?.length ? ` (cc ${cc.join(', ')})` : ''} redirigido a ${destino}`)
      await sgMail.send({
        to: destino,
        from: process.env.EMAIL_FROM!,
        subject: `[ENSAYO · para ${to}] ${subject}`,
        html,
        attachments
      })
      return
    }

    const correosCC = [
      ...(ccTorreControl ? [process.env.CORREO_TORRE_CONTROL || 'torredecontrol@gomezpinedaabogados.com'] : []),
      ...(cc || [])
    ]

    const ccUnicos = [
      ...new Set(correosCC)
    ]

    await sgMail.send({
      to,
      from: process.env.EMAIL_FROM!,
      subject,
      html,
      // SendGrid rechaza un cc vacío
      cc: ccUnicos.length > 0 ? ccUnicos : undefined,
      attachments
    })

  } catch (error: any) {

    throw error

  }
}