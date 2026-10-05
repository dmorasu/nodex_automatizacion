import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY!)

export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  cc?: string[]
) => {
  try {

    const correosCC = [
      'torredecontrol@gomezpinedaabogados.com',
      ...(cc || [])
    ]

    // Sin repetidos y sin el destinatario principal: SendGrid rechaza el envío si el mismo
    // correo está en "para" y en "copia" (ej: cuando el trámite lo creó Torre de control)
    const ccUnicos = [
      ...new Set(correosCC.map(correo => correo.trim().toLowerCase()))
    ].filter(correo => correo !== to.trim().toLowerCase())

    await sgMail.send({
      to,
      from: process.env.EMAIL_FROM!,
      subject,
      html,
      ...(ccUnicos.length > 0 && { cc: ccUnicos })
    })

  } catch (error: any) {

    throw error

  }
}