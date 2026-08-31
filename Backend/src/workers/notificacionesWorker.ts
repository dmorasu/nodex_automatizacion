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

    console.log(
      '🚨🚨🚨 WORKER NUEVO EJECUTÁNDOSE 🚨🚨🚨'
    )

    console.log(
      '📥 Job recibido:',
      job.data
    )

    console.log(
      '🆔 Job ID:',
      job.id
    )

    console.log(
      '📌 Queue:',
      job.queueName
    )

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

      message,

      solicitudTramiteId,

      mediaUrl

    } = job.data


    try {

      // =====================================
      // EMAIL
      // =====================================

      if (canal === 'EMAIL') {

        console.log(
          '📧 Enviando email...'
        )

        console.log(
          '📧 Para:',
          to
        )

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

        console.log(
          '✅ EMAIL ENVIADO'
        )

      }


      // =====================================
      // WHATSAPP
      // =====================================

      if (canal === 'WHATSAPP') {

        console.log(
          '📲 Enviando template WhatsApp...'
        )


        // =====================================
        // 1. ENVIAR TEMPLATE APROBADO
        // =====================================

        await sendWhatsApp({

          to,

          body: message,

          templateSid:
            job.data.templateSid,

          variables:
            job.data.variables

        })

        console.log(
          '✅ TEMPLATE WHATSAPP ENVIADO'
        )


        // =====================================
        // 2. ENVIAR PDF
        // =====================================

        if (mediaUrl) {

          console.log(
            '📎 ENVIANDO PDF...'
          )

          console.log(
            '🔗 URL PDF:',
            mediaUrl
          )

          await sendWhatsApp({

            to,

            body:
              `📎 Documentos correspondientes al trámite #${solicitudTramiteId}`,

            mediaUrl

          })

          console.log(
            '✅ PDF ENVIADO POR WHATSAPP'
          )

        } else {

          console.log(
            'ℹ️ No hay PDF adjunto para esta notificación'
          )

        }

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

        estado:
          'ENVIADO',

        fechaEnvio:
          new Date(),

        error:
          null

      })


      console.log(
        '✅ Notificación actualizada como ENVIADA'
      )


    } catch (error: any) {

      console.error(
        '❌ ERROR:',
        error.message
      )


      // =====================================
      // ACTUALIZAR NOTIFICACIÓN ERROR
      // =====================================

      await Notificacion.update(

        {

          estado:
            'ERROR',

          error:
            error.message

        },

        {

          where: {

            id:
              notificacionId

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