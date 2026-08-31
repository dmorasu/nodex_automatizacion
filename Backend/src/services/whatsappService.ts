import twilio from "twilio"
import dotenv from "dotenv"

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
  mediaUrl?: string
}

export const sendWhatsApp = async ({
  to,
  body,
  templateSid,
  variables,
  mediaUrl
}: WhatsAppParams) => {

  console.log("📲 Enviando WhatsApp a:", to)

  // =====================================
  // TEMPLATE META
  // =====================================

  if (templateSid) {

    console.log("📲 ENVIANDO TEMPLATE")

    const mensaje = await client.messages.create({

      from:
        process.env.TWILIO_WHATSAPP_FROM!,

      to:
        `whatsapp:${to}`,

      contentSid:
        templateSid,

      contentVariables:
        JSON.stringify(
          variables || {}
        )

    })

    console.log("📩 TWILIO SID:", mensaje.sid)
    console.log("📊 TWILIO STATUS:", mensaje.status)
    console.log("❌ TWILIO ERROR:", mensaje.errorCode)

    return mensaje
  }

  // =====================================
  // MENSAJE NORMAL CON PDF
  // =====================================

  console.log("📎 MEDIA URL:", mediaUrl)

  const mensaje = await client.messages.create({

    from:
      process.env.TWILIO_WHATSAPP_FROM!,

    to:
      `whatsapp:${to}`,

    body,

    mediaUrl:
      mediaUrl
        ? [mediaUrl]
        : undefined

  })

  console.log("📩 PDF TWILIO SID:", mensaje.sid)
  console.log("📊 PDF TWILIO STATUS:", mensaje.status)
  console.log("❌ PDF TWILIO ERROR:", mensaje.errorCode)

  return mensaje
}