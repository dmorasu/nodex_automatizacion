import { notificationQueue } from '../queues/notificacionesQueues'
import Notificacion from '../models/notificaciones'
import {
  generarPdfDocumentosSolicitud
} from "../services/generarDocumentosPDFSolicitudes"

import {
  construirMensaje,
  TipoNotificacion
} from './template/notificacionesPlantilla'

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

  const {
    subject,
    text,
    html
  } = construirMensaje(
    tipo,
    solicitud,
    data
  )

  console.log('📧 SUBJECT GENERADO:', subject)
  console.log('🔥 Tipo notificación:', tipo)

  // =====================================
  // WHATSAPP
  // =====================================
  if (tipo === "ASIGNADO") {

    if (
      !destinatario?.numeroTramitador
    ) {

      console.log(
        "❌ Sin número tramitador"
      )

      return
    }

    // =====================================
    // CREAR NOTIFICACIÓN
    // =====================================

    const notif =
      await Notificacion.create({

        solicitudTramiteId:
          solicitud.id,

        tipo,

        canal:
          "WHATSAPP",

        destinatario:
          destinatario.numeroTramitador,

        mensaje:
          text,

        estado:
          "PENDIENTE"

      })

    console.log(
      "💾 NOTIFICACIÓN WHATSAPP CREADA:",
      notif.id
    )

    const notifId =
      notif.getDataValue(
        "id"
      )

    // =====================================
    // GENERAR PDF DOCUMENTOS
    // =====================================

    let mediaUrl:
      string | undefined

    try {

      console.log(
        "📄 BUSCANDO DOCUMENTOS DEL TRÁMITE..."
      )

      const pdf =
        await generarPdfDocumentosSolicitud(
          solicitud.id
        )

      if (pdf) {

        mediaUrl =
          pdf.mediaUrl

        console.log(
          "📎 PDF LISTO PARA WHATSAPP"
        )

        console.log(
          "📄 DOCUMENTOS:",
          pdf.totalDocumentos
        )

        console.log(
          "📃 PÁGINAS:",
          pdf.totalPaginas
        )
      }

    } catch (error) {

      console.error(
        "⚠️ NO SE PUDO GENERAR EL PDF:",
        error
      )

    }

    // =====================================
    // AGREGAR JOB A REDIS
    // =====================================

    await notificationQueue.add(
      "send",
      {

        notificacionId:
          notifId,

        solicitudTramiteId:
          solicitud.id,

        canal:
          "WHATSAPP",

        to:
          destinatario.numeroTramitador,

        templateSid:
          "HXdcf69d425019b1e6572b7757ce14d59e",

        variables: {

          "1":
            data.nombre ||
            "Tramitador",

          "2":
            String(
              data.valor || "0"
            ),

          "3":
            data.fecha ||
            "Pendiente",

          "4":
            data.solicitante ||
            "N/A",

          "5":
            String(
              solicitud.id || "N/A"
            ),

          "6":
            data.programador ||
            "N/A"

        },

        // =====================================
        // PDF
        // =====================================

        mediaUrl

      }
    )

    console.log(
      "📥 WHATSAPP AGREGADO A COLA"
    )

    console.log(
      "📎 PDF:",
      mediaUrl
        ? "ADJUNTADO"
        : "SIN DOCUMENTOS"
    )

    return
  }

  // =====================================
  // EMAIL
  // =====================================
  const tiposEmail: TipoNotificacion[] = [
    'FINALIZADO',
    'EN_ESPERA_POR_NOVEDAD',
    'PROGRAMACION',
    'TRAZABILIDAD',
    'LOGISTICA'
  ]

  console.log(
    '🔍 ¿TIPO PERMITIDO PARA EMAIL?:',
    tiposEmail.includes(tipo)
  )

  if (tiposEmail.includes(tipo)) {

    if (!destinatario?.correoUsuario) {

      console.log(
        '❌ Sin correo usuario'
      )

      return
    }

    const notif =
      await Notificacion.create({

        solicitudTramiteId:
          solicitud.id,

        tipo,

        canal:
          'EMAIL',

        destinatario:
          destinatario.correoUsuario,

        mensaje:
          html,

        estado:
          'PENDIENTE'

      })

    console.log(
      '💾 NOTIFICACIÓN EMAIL CREADA'
    )

    console.log(
      '🆔 NOTIFICACIÓN ID:',
      notif.id
    )

    const notifId =
      notif.getDataValue('id')

    let cc: string[] = []

    // =====================================
    // CC ESPECIAL PARA NOVEDADES
    // =====================================

    if (
      tipo === 'EN_ESPERA_POR_NOVEDAD' &&
      Number(solicitud.operacionesId) === 9
    ) {

      cc.push(
        'novedadesvehiculos@gomezpinedaabogados.com'
      )
    }

    console.log(
      '📧 DESTINATARIO:',
      destinatario.correoUsuario
    )

    console.log(
      '📧 CC:',
      cc.length > 0
        ? cc.join(', ')
        : 'Sin copia adicional'
    )

    console.log(
      '📤 AGREGANDO JOB A REDIS...'
    )

    const job =
      await notificationQueue.add(
        'send',
        {

          notificacionId:
            notifId,

          canal:
            'EMAIL',

          to:
            destinatario.correoUsuario,

          cc:
            cc.length > 0
              ? cc
              : undefined,

          subject,

          message:
            html

        }
      )

    console.log(
      '✅ EMAIL AGREGADO A COLA'
    )

    console.log(
      '🆔 JOB ID:',
      job.id
    )

    console.log(
      '📌 QUEUE:',
      notificationQueue.name
    )

    return
  }

  console.log(
    '⚠️⚠️⚠️ TIPO NO MANEJADO ⚠️⚠️⚠️'
  )

  console.log(
    'TIPO RECIBIDO:',
    tipo
  )
}