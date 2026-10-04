import sgMail from '@sendgrid/mail'

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

    const correosCC = [
      ...(ccTorreControl ? ['torredecontrol@gomezpinedaabogados.com'] : []),
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