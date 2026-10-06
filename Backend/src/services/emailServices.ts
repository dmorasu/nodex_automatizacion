import sgMail from '@sendgrid/mail'
import { correoEnsayo, modoEnsayo } from '../utils/modoEnsayo'

sgMail.setApiKey(process.env.SENDGRID_API_KEY!)

export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  cc?: string[],
  // Los correos de trámites van con copia a la torre de control; los de gastos no
  ccTorreControl = true
) => {
  try {

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
        html
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
      cc: ccUnicos.length > 0 ? ccUnicos : undefined
    })

  } catch (error: any) {

    throw error

  }
}