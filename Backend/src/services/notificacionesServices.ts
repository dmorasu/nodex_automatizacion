// services/notificaciones.service.ts

import { notificationQueue } from '../queues/notificacionesQueues'
import Notificacion from '../models/notificaciones'
import { construirMensaje, TipoNotificacion } from './template/notificacionesPlantilla'

type NotificacionParams = {
  solicitud: any
  tipo: TipoNotificacion
  destinatario: any
  data?: any
}

export const crearNotificacion = async ({
  solicitud,
  tipo,
  destinatario,
  data = {}
}: NotificacionParams) => {

  const { subject, text, html } = construirMensaje(tipo, solicitud, data)

  console.log('🔥 Tipo notificación:', tipo)

  // =========================
  // 📲 WHATSAPP → ASIGNADO
  // =========================
  if (tipo === 'ASIGNADO') {

    if (!destinatario?.numeroTramitador) {
      console.log('❌ Sin número tramitador')
      return
    }

    // 🔥 Guardar notificación
    const notif = await Notificacion.create({

      solicitudTramiteId: solicitud.id,

      tipo,

      canal: 'WHATSAPP',

      destinatario: destinatario.numeroTramitador,

      mensaje: text,

      estado: 'PENDIENTE'

    })

    const notifId = notif.getDataValue('id')

    // 🔥 Enviar a cola BullMQ
    await notificationQueue.add('send', {

      notificacionId: notifId,

      canal: 'WHATSAPP',

      to: destinatario.numeroTramitador,

      // 🔥 TEMPLATE META
      templateSid: 'HXdcf69d425019b1e6572b7757ce14d59e',

      // 🔥 VARIABLES TEMPLATE
      variables: {

        "1": data.nombre || 'Tramitador',

        "2": data.valor || '0',

        "3": data.fecha || 'Pendiente',

        "4": data.solicitante || 'N/A',

        "5": solicitud.id?.toString() || 'N/A',

        "6": data.programador || 'N/A'

      }

    })

    console.log('✅ WhatsApp agregado a cola')

    return
  }

  // =========================
  // 📧 EMAIL → RESTO
  // =========================
  const tiposEmail: TipoNotificacion[] = [
    'FINALIZADO',
    'CAMBIO_ESTADO',
    'PROGRAMACION',
    'TRAZABILIDAD'
  ]

  if (tiposEmail.includes(tipo)) {

    if (!destinatario?.correoUsuario) {
      console.log('❌ Sin correo usuario')
      return
    }

    const notif = await Notificacion.create({

      solicitudTramiteId: solicitud.id,

      tipo,

      canal: 'EMAIL',

      destinatario: destinatario.correoUsuario,

      mensaje: html,

      estado: 'PENDIENTE'

    })

    const notifId = notif.getDataValue('id')

    await notificationQueue.add('send', {

      notificacionId: notifId,

      canal: 'EMAIL',

      to: destinatario.correoUsuario,

      subject,

      message: html

    })

    console.log('✅ Email agregado a cola')

    return
  }

  console.log('⚠️ Tipo no manejado:', tipo)

}