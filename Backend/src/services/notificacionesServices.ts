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


  console.log(
    '📧 SUBJECT GENERADO:',
    subject
  )

  console.log(
    '🔥 Tipo notificación:',
    tipo
  )


  // =====================================
  // WHATSAPP - ASIGNADO
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
    // LINK CENTRAL TORRE DE CONTROL
    // =====================================

    const link =
      "https://wa.me/573166507738?utm_source=chatgpt.com"


    // =====================================
    // VARIABLES TWILIO
    // =====================================

    const variables: Record<string, string> = {

      "1":
        String(
          data.nombre ||
          "Nombre Tramitador"
        ),

      "2":
        String(
          data.numeroTramite ||
          "Número Solicitud"
        ),

      "3":
        String(
          data.tipoTramite ||
          "Tipo de Trámite"
        ),

      "4":
        String(
          data.ubicacion ||
          "Dirección Trámite"
        ),

      "5":
        String(
          data.mueble ||
          "Placa o Matricula"
        ),

      "6":
        String(
          data.cliente ||
          "Nombre del Cliente"
        ),

      "7":
        String(
          data.tarifa ??
          "N/A"
        ),

      "8":
        String(
          data.fecha ||
          "N/A"
        ),

      "9":
        String(
          data.programador ||
          "N/A"
        ),

      "10":
        String(
          data.solicitante ||
          "N/A"
        ),

      "11":
        String(
          link
        )

    }


    if (mediaUrl) {

      variables["12"] =
        mediaUrl

    }


    const templateSid =
      mediaUrl
        ? "HX5f9cccdf40ed318dcdc85f97b22ea97f"
        : "HXaef0b548184ee7432dc8434e22606cbe"


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

        templateSid,

        variables

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
  // WHATSAPP - DESISTIDO
  // =====================================

  if (tipo === "DESISTIDO") {

    if (
      !destinatario?.numeroTramitador
    ) {

      console.log(
        "❌ Sin número tramitador para DESISTIDO"
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
      "💾 NOTIFICACIÓN DESISTIDO CREADA:",
      notif.id
    )


    const notifId =
      notif.getDataValue(
        "id"
      )


    // =====================================
    // LINK CENTRAL TORRE DE CONTROL
    // =====================================

    const link =
      "https://wa.me/573166507738?utm_source=chatgpt.com"


    // =====================================
    // VARIABLES TWILIO
    // =====================================

    const variables: Record<string, string> = {

      // {{1}} - Nombre
      "1":
        String(
          data.nombre ||
          "N/A"
        ),

      // {{2}} - Tipo
      "2":
        String(
          data.tipo ||
          "N/A"
        ),

      // {{3}} - Placa / Matrícula
      "3":
        String(
          data.mueble ||
          "N/A"
        ),

      // {{4}} - Cliente
      "4":
        String(
          solicitud.clientes?.nombreCliente ||
          "N/A"
        ),

      // {{5}} - Número de solicitud
      "5":
        String(
          solicitud.id
        ),

      // {{6}} - Programador
      "6":
        String(
          data.programador ||
          "N/A"
        ),

      // {{7}} - Link soporte
      "7":
        String(
          link
        )

    }


    // =====================================
    // TEMPLATE TWILIO
    // =====================================

    const templateSid =
      "HXdc84769685d853246741b746ec42474d"


    console.log(
      "📱 TEMPLATE DESISTIDO:",
      templateSid
    )


    console.log(
      "📦 VARIABLES DESISTIDO:",
      variables
    )


    // =====================================
    // AGREGAR JOB A REDIS
    // =====================================

    const job =
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

          templateSid,

          variables

        }
      )


    console.log(
      "📥 WHATSAPP DESISTIDO AGREGADO A COLA"
    )


    console.log(
      "🆔 JOB ID:",
      job.id
    )


    console.log(
      "📌 TIPO:",
      tipo
    )


    return
  }


  // =====================================
  // WHATSAPP - DILIGENCIAS
  // =====================================

  if (
    tipo === "DILIGENCIA_HOY" ||
    tipo === "DILIGENCIA_VENCIDA"
  ) {

    if (
      !destinatario?.numeroTramitador
    ) {

      console.log(
        "❌ Sin número tramitador para diligencia"
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
      "💾 NOTIFICACIÓN DILIGENCIA CREADA:",
      notif.id
    )


    const notifId =
      notif.getDataValue(
        "id"
      )


    // =====================================
    // LINK CENTRAL TORRE DE CONTROL
    // =====================================

    const link =
      "https://wa.me/573166507738?utm_source=chatgpt.com"


    // =====================================
    // VARIABLES TWILIO
    // =====================================

    let variables:
      Record<string, string>


    if (
      tipo === "DILIGENCIA_HOY"
    ) {

      variables = {

        "1":
          String(
            data.nombre ||
            "N/A"
          ),

        "2":
          String(
            data.tipo ||
            "N/A"
          ),

        "3":
          String(
            data.mueble ||
            "N/A"
          ),

        "4":
          String(
            data.ubicacion ||
            "N/A"
          ),

        "5":
          String(
            solicitud.id
          ),

        "6":
          String(
            data.programador ||
            "N/A"
          ),

        "7":
          String(
            link
          )

      }

    } else {

      variables = {

        "1":
          String(
            data.nombre ||
            "N/A"
          ),

        "2":
          String(
            data.tipo ||
            "N/A"
          ),

        "3":
          String(
            data.mueble ||
            "N/A"
          ),

        "4":
          String(
            data.ubicacion ||
            "N/A"
          ),

        "5":
          String(
            solicitud.id
          ),

        "6":
          String(
            data.fecha ||
            "N/A"
          ),

        "7":
          String(
            data.programador ||
            "N/A"
          ),

        "8":
          String(
            link
          )

      }

    }


    // =====================================
    // TEMPLATE SID
    // =====================================

    const templateSid =
      tipo === "DILIGENCIA_HOY"

        ? "HX5d15ace33674672f1ee35eb492d2b770"

        : "HXe57c28804506a56954918bf20754cb3a"


    console.log(
      "📱 TEMPLATE SID:",
      templateSid
    )


    console.log(
      "📦 VARIABLES:",
      variables
    )


    // =====================================
    // AGREGAR JOB A REDIS
    // =====================================

    const job =
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

          templateSid,

          variables

        }
      )


    console.log(
      "📥 WHATSAPP DILIGENCIA AGREGADO A COLA"
    )


    console.log(
      "🆔 JOB ID:",
      job.id
    )


    console.log(
      "📌 TIPO:",
      tipo
    )


    return

  }


  // =====================================
  // EMAIL
  // =====================================

  const tiposEmail:
    TipoNotificacion[] = [

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


  if (
    tiposEmail.includes(tipo)
  ) {

    if (
      !destinatario?.correoUsuario
    ) {

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
      notif.getDataValue(
        'id'
      )


    let cc:
      string[] = []


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