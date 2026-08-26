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

    await sgMail.send({
      to,
      from: process.env.EMAIL_FROM!,
      subject,
      html,
      cc: correosCC
    })

  } catch (error: any) {

    throw error

  }
}