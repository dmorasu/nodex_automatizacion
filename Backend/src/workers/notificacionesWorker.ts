import 'dotenv/config'
import '../config/db'

import { Worker } from 'bullmq'
import { connection } from '../config/redis'
import { sendEmail } from '../services/emailServices'
import { sendWhatsApp } from '../services/whatsappService'
import Notificacion from '../models/notificaciones'

new Worker('notifications', async job => {

  const { notificacionId, canal, to, subject, message } = job.data

  console.log('📥 Job recibido:', job.data)

  try {

    if (canal === 'EMAIL') {
      console.log('📧 Enviando email...')
      await sendEmail(to, subject, message)
    }

    if (canal === 'WHATSAPP') {
      console.log('📲 Enviando WhatsApp...')
      await sendWhatsApp({
  to,
  body: message,
  templateSid: job.data.templateSid,
  variables: job.data.variables
})
    }

    const notif = await Notificacion.findByPk(notificacionId)

    if (!notif) {
      console.log('❌ No existe notificación:', notificacionId)
      return
    }

    await notif.update({
      estado: 'ENVIADO',
      fechaEnvio: new Date(),
      error: null
    })

    console.log('✅ Notificación actualizada')

  } catch (error: any) {

    console.error('❌ ERROR:', error.message)

    await Notificacion.update({
      estado: 'ERROR',
      error: error.message
    }, { where: { id: notificacionId } })

    throw error
  }

}, { connection })