import 'dotenv/config'
import '../config/db'

import { Worker } from 'bullmq'

import {
  connection
} from '../config/redis'

import {
  sendEmail
} from '../services/emailServices'

import {
  sendWhatsApp
} from '../services/whatsappService'

import Notificacion from '../models/notificaciones'


new Worker(

  'notifications',

  async job => {

    // ================================
    // LOGS DEL JOB
    // ================================

    console.log('🚨🚨🚨 WORKER NUEVO EJECUTÁNDOSE - VERSION 999 🚨🚨🚨')

    console.log('📥 Job recibido:', job.data)

    console.log('🆔 Job ID:', job.id)

    console.log('📌 Queue:', job.queueName)

    console.log(
      '📅 Timestamp:',
      new Date(job.timestamp).toLocaleString()
    )

    console.log(
      '🔄 Attempts:',
      job.attemptsMade
    )

    // ================================
    // EXTRAER DATOS
    // ================================

    const {
      notificacionId,
      canal,
      to,
      cc,
      subject,
      message
    } = job.data

    try {

      // =====================================
      // EMAIL
      // =====================================

      if (canal === 'EMAIL') {

        console.log('📧 Enviando email...')

        console.log('📧 Para:', to)

        console.log(
          '📧 CC:',
          cc || 'Sin copia'
        )

        console.log(
          '📧 Asunto:',
          subject
        )

        await sendEmail(
          to,
          subject,
          message,
          cc
        )
      }


      // =====================================
      // WHATSAPP
      // =====================================

      if (canal === 'WHATSAPP') {

        console.log('📲 Enviando WhatsApp...')

        await sendWhatsApp({

          to,

          body: message,

          templateSid:
            job.data.templateSid,

          variables:
            job.data.variables
        })
      }


      // =====================================
      // BUSCAR NOTIFICACIÓN
      // =====================================

      const notif =
        await Notificacion.findByPk(
          notificacionId
        )

      if (!notif) {

        console.log(
          '❌ No existe notificación:',
          notificacionId
        )

        return
      }


      // =====================================
      // ACTUALIZAR ESTADO
      // =====================================

      await notif.update({

        estado: 'ENVIADO',

        fechaEnvio: new Date(),

        error: null
      })

      console.log(
        '✅ Notificación actualizada'
      )

    } catch (error: any) {

      console.error(
        '❌ ERROR:',
        error.message
      )

      await Notificacion.update(

        {

          estado: 'ERROR',

          error: error.message
        },

        {

          where: {

            id: notificacionId
          }
        }
      )

      throw error
    }

  },

  {

    connection

  }
)