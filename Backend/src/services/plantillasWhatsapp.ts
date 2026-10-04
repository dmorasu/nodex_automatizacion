import twilio from 'twilio'
import dotenv from 'dotenv'

dotenv.config()

// =====================================
// TEXTO REAL DE LAS PLANTILLAS DE WHATSAPP
// Lo que se envía es la plantilla aprobada en Twilio (Content API) con sus variables {{n}}.
// En Notificaciones.mensaje se guarda ese mismo texto, no uno armado en el código, para que
// Nodex muestre exactamente lo que recibió el tramitador.
// =====================================

type Plantilla = { cuerpo: string, conAdjunto: boolean }

// Copia de las plantillas aprobadas (2026-10-03). Solo se usa si Twilio no responde;
// normalmente el texto se lee de Twilio, así un cambio de plantilla se refleja solo.
const COPIA_PLANTILLAS: Record<string, Plantilla> = {
  // ASIGNADO_CON_PDF
  HXa99c54a116f11a8c1fac4158feefb40d: {
    conAdjunto: true,
    cuerpo: '📢 *Diligencia asignada*\n\nHola {{1}},\n\nTienes una diligencia programada por Gómez Pineda Abogados S.A.S. A continuación, te compartimos los detalles:\n\n📋 *Detalles*\n• *Solicitud:* {{2}}\n• *Tipo:* {{3}}\n• *Detalle:* {{4}}\n• *Ubicación:* {{5}}\n• *Placa/Matrícula:* {{6}}\n• *Cliente:* {{7}}\n• *Tarifa:* {{8}}\n• *Fecha:* {{9}}\n\n👥 *Asignación*\n• *Programador:* {{10}}\n• *Solicitante:* {{11}}\n\n📞 *Soporte*\n¿Tienes alguna inquietud? Comunícate con la Central Torre de Control:\n{{12}}\n\n✅ Gracias por tu apoyo y gestión.'
  },
  // ASIGNADO_SIN_PDF
  HXf9d1720fe95164674fdcf0a016a811da: {
    conAdjunto: false,
    cuerpo: '📢 *Diligencia asignada*\n\nHola {{1}} 😀,\n\nTienes una diligencia programada por Gómez Pineda Abogados S.A.S.. A continuación, te compartimos los detalles:\n\n📋 *Detalles*\n• *Solicitud:* {{2}}\n• *Tipo:* {{3}}\n• *Detalle:* {{4}}\n• *Ubicacion:* {{5}}\n• *Placa/Matrícula:* {{6}}\n• *Cliente:* {{7}}\n• *Tarifa:* {{8}}\n• *Fecha:* {{9}}\n\n\n👥 *Asignación*\n\n• *Programador:* {{10}}\n• *Solicitante:* {{11}}\n\n📞 *Soporte*\n\n¿Tienes alguna inquietud? Comunícate con la Central Torre de Control:\n\n{{12}}\n\n\n\n✅ Gracias por tu apoyo y gestión.'
  },
  // DESISTIDO
  HXdc84769685d853246741b746ec42474d: {
    conAdjunto: false,
    cuerpo: '📢 Diligencia Cancelada\nHola {{1}} ,\n\nTe informamos que la siguiente diligencia asignada por Gómez Pineda Abogados S.A.S. ha sido cancelada, por lo que no es necesario continuar con la gestión programada.\n\n📋 Detalles\n\n• Tipo: {{2}}\n• Placa/Matrícula: {{3}}\n• Cliente: {{4}} \n• Número de Solicitud: {{5}} \n\n👤 Responsable\n\n• Programador: {{6}}\nSi cuentas con documentación o novedades relacionadas con esta diligencia, por favor compártelas a través de los canales habituales de atención.\n\n📞 Soporte\n\nPara cualquier inquietud, comunícate con la Central Torre de Control:\n\n🔗 {{7}}\n\n✅ Gracias por tu apoyo y colaboración.'
  },
  // DILIGENCIA_HOY
  HX5124a3f392efb6f07b8b4ed22786b9ec: {
    conAdjunto: false,
    cuerpo: '📢 Diligencia Programada para Hoy\n\nHola {{1}} ,\n\nTe recordamos que hoy tienes una diligencia programada por Gómez Pineda Abogados S.A.S.\n\n📋 Detalles\n\n• Tipo: {{2}}\n• Detalle: {{3}}\n• Placa/Matrícula: {{4}}\n• Ubicación: {{5}} \n• Número de Solicitud: {{6}} \n• Estado: En Curso\n\n👤 Responsable\n\n• Programador: {{7}}\n\n📞 Soporte\n\nRecuerda cargar los soportes correspondientes y reportar cualquier novedad durante la gestión.\n\nSi requieres apoyo, comunícate con la Central Torre de Control:\n\n🔗 {{8}}\n\n✅ Gracias por tu gestión. Te deseamos una excelente jornada.'
  },
  // DILIGENCIA_VENCIDA
  HXa8990ef995f16aa61ac2fcbeb6cabc88: {
    conAdjunto: false,
    cuerpo: '📢 Diligencia Programada para Hoy\n\nHola {{1}} ,\n\nObservamos que la diligencia programada por Gómez Pineda Abogados S.A.S. ya superó la fecha prevista. Agradecemos nos compartas una actualización sobre su estado.\n\n📋 Detalles\n\n• Tipo: {{2}}\n• Detalle: {{3}}\n• Placa/Matrícula: {{4}}\n• Ubicación: {{5}} \n• Número de Solicitud: {{6}} \n• Estado: En Curso - Vencida\n• Fecha Programada: {{7}}\n\n👤 Responsable\n\n• Programador: {{8}}\n\n📞 Soporte\n\nRecuerda cargar los soportes correspondientes y reportar cualquier novedad durante la gestión.\n\nSi requieres apoyo, comunícate con la Central Torre de Control:\n\n🔗 {{9}}\n\n✅ Gracias por tu gestión. Te deseamos una excelente jornada.'
  }
}

const UNA_HORA = 60 * 60 * 1000
const cache = new Map<string, { plantilla: Plantilla, leidaEn: number }>()

let cliente: ReturnType<typeof twilio> | null = null
const clienteTwilio = () => (cliente ??= twilio(process.env.TWILIO_SID!, process.env.TWILIO_AUTH_TOKEN!))

// Cuerpo de la plantilla aprobada (de Twilio, con caché de 1 hora; si falla, la copia local)
const obtenerPlantilla = async (templateSid: string): Promise<Plantilla | null> => {
  const guardada = cache.get(templateSid)
  if (guardada && Date.now() - guardada.leidaEn < UNA_HORA) return guardada.plantilla

  try {
    const contenido = await clienteTwilio().content.v1.contents(templateSid).fetch()
    const tipos = contenido.types as Record<string, { body?: string, media?: string[] }>
    const tipo = Object.values(tipos).find(t => typeof t?.body === 'string')
    if (tipo?.body) {
      const plantilla = { cuerpo: tipo.body, conAdjunto: Array.isArray(tipo.media) && tipo.media.length > 0 }
      cache.set(templateSid, { plantilla, leidaEn: Date.now() })
      return plantilla
    }
  } catch (error) {
    console.warn(`⚠️ No se pudo leer la plantilla ${templateSid} de Twilio; se usa la copia local`, (error as Error).message)
  }

  return guardada?.plantilla ?? COPIA_PLANTILLAS[templateSid] ?? null
}

// Texto exacto que recibe el destinatario: la plantilla con sus variables reemplazadas.
// Si la plantilla lleva adjunto (PDF), se anota al final.
export const textoDePlantilla = async (
  templateSid: string,
  variables: Record<string, string>
): Promise<string | null> => {
  const plantilla = await obtenerPlantilla(templateSid)
  if (!plantilla) return null

  const texto = plantilla.cuerpo.replace(/\{\{(\d+)\}\}/g, (marca, numero: string) => variables[numero] ?? marca)
  if (!plantilla.conAdjunto) return texto

  const numeros = Object.keys(variables).map(Number).sort((a, b) => a - b)
  const adjunto = variables[String(numeros[numeros.length - 1])]
  return adjunto ? `${texto}\n\n📎 Adjunto: ${adjunto}` : texto
}
