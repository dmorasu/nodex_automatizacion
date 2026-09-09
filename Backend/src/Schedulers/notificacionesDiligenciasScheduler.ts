import cron from "node-cron"

import {
  obtenerDiligenciasDeHoy,
  obtenerDiligenciasVencidas
} from "../services/notificacionesDiligenciasServices"

import {
  crearNotificacion
} from "../services/notificacionesServices"


// ======================================================
// 08:00 AM - DILIGENCIAS DE HOY
// ======================================================

cron.schedule(

  "48 13 * * *",

  async () => {

    console.log(
      "🕗 CRON 08:00 AM - DILIGENCIAS DE HOY"
    )

    try {

      // ==================================================
      // BUSCAR DILIGENCIAS
      // ==================================================

      const diligencias =
        await obtenerDiligenciasDeHoy()


      console.log(
        "📋 Diligencias encontradas:",
        diligencias.length
      )


      // ==================================================
      // CREAR NOTIFICACIÓN PARA CADA DILIGENCIA
      // ==================================================

      for (
        const solicitud of diligencias
      ) {

        try {

          console.log(
            "📱 CREANDO NOTIFICACIÓN DILIGENCIA HOY:",
            solicitud.id
          )


          // ==============================================
          // DATOS PARA LA PLANTILLA
          // ==============================================

          const data = {

            nombre:
              solicitud
                .tramitador
                ?.nombreTramitador,

            tipo:
              solicitud
                .tramite
                ?.nombreTramite,

            mueble:
              solicitud.placa ||
              solicitud.matriculaInmobiliaria ||
              "",

            ubicacion:
              solicitud.direccionTramite,

            programador:
              solicitud
                .municipios
                ?.responsable

          }


          console.log(
            "📦 DATA NOTIFICACIÓN:",
            data
          )


          // ==============================================
          // CREAR NOTIFICACIÓN
          // ==============================================

          await crearNotificacion({

            solicitud,

            tipo:
              "DILIGENCIA_HOY",

            destinatario:
              solicitud.tramitador,

            data

          })


          console.log(
            "✅ NOTIFICACIÓN DILIGENCIA HOY CREADA:",
            solicitud.id
          )

        } catch (error) {

          console.error(
            "❌ ERROR CREANDO NOTIFICACIÓN PARA SOLICITUD:",
            solicitud.id,
            error
          )

        }

      }

    } catch (error) {

      console.error(
        "❌ Error en cron de diligencias de hoy:",
        error
      )

    }

  },

  {
    timezone: "America/Bogota"
  }

)


// ======================================================
// 12:00 PM - DILIGENCIAS VENCIDAS
// ======================================================

cron.schedule(

  "50 13 * * *",

  async () => {

    console.log(
      "🚨 CRON 12:00 PM - DILIGENCIAS VENCIDAS"
    )

    try {

      // ==================================================
      // BUSCAR DILIGENCIAS VENCIDAS
      // ==================================================

      const diligencias =
        await obtenerDiligenciasVencidas()


      console.log(
        "📋 Diligencias vencidas encontradas:",
        diligencias.length
      )


      // ==================================================
      // CREAR NOTIFICACIÓN PARA CADA DILIGENCIA
      // ==================================================

      for (
        const solicitud of diligencias
      ) {

        try {

          console.log(
            "📱 CREANDO NOTIFICACIÓN DILIGENCIA VENCIDA:",
            solicitud.id
          )


          // ==============================================
          // DATOS PARA LA PLANTILLA
          // ==============================================

          const data = {

            nombre:
              solicitud
                .tramitador
                ?.nombreTramitador,

            tipo:
              solicitud
                .tramite
                ?.nombreTramite,

            mueble:
              solicitud.placa ||
              solicitud.matriculaInmobiliaria ||
              "",

            ubicacion:
              solicitud.direccionTramite,

            fecha:
              solicitud
                .programacion
                ?.fechaProbableEntrega,

            programador:
              solicitud
                .tramite
                ?.responsable

          }


          console.log(
            "📦 DATA NOTIFICACIÓN:",
            data
          )


          // ==============================================
          // CREAR NOTIFICACIÓN
          // ==============================================

          await crearNotificacion({

            solicitud,

            tipo:
              "DILIGENCIA_VENCIDA",

            destinatario:
              solicitud.tramitador,

            data

          })


          console.log(
            "✅ NOTIFICACIÓN DILIGENCIA VENCIDA CREADA:",
            solicitud.id
          )

        } catch (error) {

          console.error(
            "❌ ERROR CREANDO NOTIFICACIÓN PARA SOLICITUD:",
            solicitud.id,
            error
          )

        }

      }

    } catch (error) {

      console.error(
        "❌ Error en cron de diligencias vencidas:",
        error
      )

    }

  },

  {
    timezone: "America/Bogota"
  }

)


// ======================================================
// SCHEDULER INICIADO
// ======================================================

console.log(
  "⏰ Scheduler de diligencias iniciado"
)

console.log(
  "🇨🇴 Zona horaria: America/Bogota"
)

console.log(
  "🕗 Diligencias de hoy: 08:00 AM"
)

console.log(
  "🚨 Diligencias vencidas: 12:00 PM"
)