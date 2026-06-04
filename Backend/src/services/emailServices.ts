import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY!)

export const sendEmail = async (
  to: string,
  subject: string,
  html: string
) => {
  try {
    console.log('📧 Enviando email a:', to)

    const response = await sgMail.send({
      to,
      from: process.env.EMAIL_FROM!, // dominio verificado
      subject,
      html
    })

    console.log('✅ Email enviado:', response[0].statusCode)

  } catch (error: any) {
    console.error('❌ ERROR EMAIL:', error.response?.body || error.message)
    throw error
  }
}