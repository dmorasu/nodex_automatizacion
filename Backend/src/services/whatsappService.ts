import twilio from 'twilio'
import dotenv from 'dotenv'

dotenv.config()

const client = twilio(
  process.env.TWILIO_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

type WhatsAppParams = {
  to: string
  body?: string
  templateSid?: string
  variables?: Record<string, string>
}

export const sendWhatsApp = async ({
  to,
  body,
  templateSid,
  variables
}: WhatsAppParams) => {

  console.log('📲 Enviando WhatsApp a:', to)

  // 🔥 TEMPLATE META
  if (templateSid) {

    return client.messages.create({

      from: process.env.TWILIO_WHATSAPP_FROM!,

      to: `whatsapp:${to}`,

      contentSid: templateSid,

      contentVariables: JSON.stringify(variables || {})

    })

  }

  // 🔥 MENSAJE NORMAL
  return client.messages.create({

    from: process.env.TWILIO_WHATSAPP_FROM!,

    to: `whatsapp:${to}`,

    body

  })

}