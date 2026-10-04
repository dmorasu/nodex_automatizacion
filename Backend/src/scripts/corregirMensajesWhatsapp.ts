import 'dotenv/config'
import twilio from 'twilio'
import { Op } from 'sequelize'
import { db } from '../config/db'
import Notificacion from '../models/notificaciones'

// =====================================
// CORRIGE EL TEXTO GUARDADO DE LAS NOTIFICACIONES DE WHATSAPP YA ENVIADAS
// Antes se guardaba un texto armado en el código, distinto de la plantilla aprobada.
// Este script busca cada mensaje en el registro de Twilio (mismo destinatario, enviado
// justo después de crear la notificación) y guarda el texto que de verdad se envió.
//
//   Revisar sin cambiar nada:  TS_NODE_TRANSPILE_ONLY=1 npx ts-node src/scripts/corregirMensajesWhatsapp.ts
//   Aplicar los cambios:       TS_NODE_TRANSPILE_ONLY=1 npx ts-node src/scripts/corregirMensajesWhatsapp.ts --aplicar
// =====================================

const APLICAR = process.argv.includes('--aplicar')
const VENTANA_MS = 15 * 60 * 1000 // el mensaje sale de la cola a los pocos segundos

type MensajeTwilio = { sid: string, to: string, body: string, fecha: number }

const normalizar = (telefono: string) => telefono.replace(/^whatsapp:/, '').replace(/[^\d+]/g, '')

const main = async () => {
  await db.authenticate()
  const cliente = twilio(process.env.TWILIO_SID!, process.env.TWILIO_AUTH_TOKEN!)

  const notificaciones = await Notificacion.findAll({
    where: { canal: 'WHATSAPP', estado: { [Op.ne]: 'ERROR' } },
    order: [['createdAt', 'ASC']]
  })
  if (notificaciones.length === 0) {
    console.log('No hay notificaciones de WhatsApp para revisar')
    return
  }

  // Un solo recorrido del registro de Twilio desde la notificación más antigua
  const desde = new Date(notificaciones[0].getDataValue('createdAt').getTime() - VENTANA_MS)
  console.log(`Leyendo mensajes de Twilio desde ${desde.toISOString()}…`)
  const mensajes = await cliente.messages.list({ from: process.env.TWILIO_WHATSAPP_FROM, dateSentAfter: desde })

  // Solo las plantillas (empiezan con 📢); se excluye el mensaje aparte del PDF
  const porDestinatario = new Map<string, MensajeTwilio[]>()
  for (const m of mensajes) {
    if (!m.body?.startsWith('📢') || !m.dateSent) continue
    const to = normalizar(m.to)
    const lista = porDestinatario.get(to) ?? []
    lista.push({ sid: m.sid, to, body: m.body, fecha: m.dateSent.getTime() })
    porDestinatario.set(to, lista)
  }

  const usados = new Set<string>()
  let corregidas = 0, iguales = 0, sinCoincidencia = 0

  for (const notif of notificaciones) {
    const creada = notif.getDataValue('createdAt').getTime()
    const candidatos = (porDestinatario.get(normalizar(notif.destinatario)) ?? [])
      .filter(m => !usados.has(m.sid) && m.fecha >= creada - 60 * 1000 && m.fecha <= creada + VENTANA_MS)
      .sort((a, b) => Math.abs(a.fecha - creada) - Math.abs(b.fecha - creada))

    const encontrado = candidatos[0]
    if (!encontrado) {
      sinCoincidencia++
      continue
    }
    usados.add(encontrado.sid)

    if (notif.mensaje?.trim() === encontrado.body.trim()) {
      iguales++
      continue
    }

    corregidas++
    console.log(`#${notif.id} (${notif.tipo}, solicitud ${notif.solicitudTramiteId}) → mensaje ${encontrado.sid}`)
    if (APLICAR) await notif.update({ mensaje: encontrado.body })
  }

  console.log(`\nRevisadas: ${notificaciones.length} · ${APLICAR ? 'corregidas' : 'por corregir'}: ${corregidas} · ya correctas: ${iguales} · sin mensaje en Twilio: ${sinCoincidencia}`)
  if (!APLICAR && corregidas > 0) console.log('Nada se modificó. Ejecute con --aplicar para guardar los cambios.')
}

main()
  .catch(error => {
    console.error('Error:', error.message)
    process.exitCode = 1
  })
  .finally(() => db.close())
