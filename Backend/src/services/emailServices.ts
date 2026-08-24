import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY!)

export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  cc?: string[]
) => {
  try {

    console.log('📧 Enviando email a:', to)

    if (cc && cc.length > 0) {
      console.log('📧 Enviando copia a:', cc.join(', '))
    }

    const response = await sgMail.send({
      to,
      from: process.env.EMAIL_FROM!,
      subject,
      html,

      ...(cc && cc.length > 0 ? { cc } : {})
    })

    console.log(
      '✅ Email enviado:',
      response[0].statusCode
    )

  } catch (error: any) {

    console.error(
      '❌ ERROR EMAIL:',
      error.response?.body || error.message
    )

    throw error
  }
}