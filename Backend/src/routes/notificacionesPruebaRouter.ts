import { Router } from "express"

import { db } from "../config/db"

import SolicitudTramites from "../models/solicitudTramites"
import Programacion from "../models/programacion"
import Tramitador from "../models/tramitador"
import Tramite from "../models/tramite"
import Estados from "../models/estados"

import {
  crearNotificacion
} from "../services/notificacionesServices"
import Municipios from "../models/municipios"



const router = Router()


// ======================================================
// FUNCIÓN GENERAL PARA PREPARAR DATOS
// ======================================================

const prepararDatos = (
  solicitud: any
) => {

  return {

    nombre:
      solicitud.tramitador?.nombreTramitador ||
      "N/A",

    tipo:
      solicitud.tramite?.nombreTramite ||
      "N/A",

    mueble:
      solicitud.placa ||
      solicitud.matriculaInmobiliaria ||
      "N/A",

    ubicacion:
      solicitud.direccionTramite ||
      "N/A",

    fecha:
      solicitud.programacion?.fechaProbableEntrega
        ? new Date(
            solicitud.programacion.fechaProbableEntrega
          ).toLocaleDateString(
            "es-CO",
            {
              timeZone: "America/Bogota"
            }
          )
        : "N/A",

    programador:
      solicitud.municipios?.responsable ||
      "N/A"

  }

}


// ======================================================
// FUNCIÓN PARA BUSCAR UNA SOLICITUD
// ======================================================

const buscarSolicitud = async (
  solicitudId: number
) => {

  return await SolicitudTramites.findByPk(
    solicitudId,
    {
      include: [

        {
          model: Programacion,
          as: "programacion",
          required: false
        },

        {
          model: Tramitador,
          as: "tramitador",
          required: false
        },

        {
          model: Tramite,
          as: "tramite",
          required: false
        },

        {
          model: Estados,
          as: "estadoActual",
          required: false
        },
        {
          model: Municipios,
          as: "municipios",
          required: false
        }

      ]
    }
  )

}


// ======================================================
// 🕗 PRUEBA DILIGENCIA DE HOY
// ======================================================

router.get(
  "/diligencia-hoy/:id",
  async (req, res) => {

    try {

      const solicitudId =
        Number(req.params.id)


      if (!Number.isInteger(solicitudId)) {

        return res.status(400).json({

          ok: false,

          mensaje:
            "El ID de solicitud no es válido"

        })

      }


      const solicitud =
        await buscarSolicitud(
          solicitudId
        )


      if (!solicitud) {

        return res.status(404).json({

          ok: false,

          mensaje:
            `No existe la solicitud ${solicitudId}`

        })

      }


      if (!solicitud.tramitador) {

        return res.status(400).json({

          ok: false,

          mensaje:
            "La solicitud no tiene tramitador asociado"

        })

      }


      if (
        !solicitud.tramitador.numeroTramitador
      ) {

        return res.status(400).json({

          ok: false,

          mensaje:
            "El tramitador no tiene número de WhatsApp"

        })

      }


      const data =
        prepararDatos(
          solicitud
        )


      await crearNotificacion({

        solicitud,

        tipo:
          "DILIGENCIA_HOY",

        destinatario:
          solicitud.tramitador,

        data

      })


      return res.json({

        ok: true,

        mensaje:
          "Notificación de diligencia de HOY agregada a BullMQ",

        solicitudId,

        tipo:
          "DILIGENCIA_HOY"

      })

    } catch (error) {

      console.error(
        "❌ ERROR DILIGENCIA HOY:",
        error
      )

      return res.status(500).json({

        ok: false,

        mensaje:
          error instanceof Error
            ? error.message
            : "Error ejecutando prueba"

      })

    }

  }
)


// ======================================================
// 🚨 PRUEBA DILIGENCIA VENCIDA
// ======================================================

router.get(
  "/diligencia-vencida/:id",
  async (req, res) => {

    try {

      const solicitudId =
        Number(req.params.id)


      if (!Number.isInteger(solicitudId)) {

        return res.status(400).json({

          ok: false,

          mensaje:
            "El ID de solicitud no es válido"

        })

      }


      const solicitud =
        await buscarSolicitud(
          solicitudId
        )


      if (!solicitud) {

        return res.status(404).json({

          ok: false,

          mensaje:
            `No existe la solicitud ${solicitudId}`

        })

      }


      if (!solicitud.tramitador) {

        return res.status(400).json({

          ok: false,

          mensaje:
            "La solicitud no tiene tramitador asociado"

        })

      }


      if (
        !solicitud.tramitador.numeroTramitador
      ) {

        return res.status(400).json({

          ok: false,

          mensaje:
            "El tramitador no tiene número de WhatsApp"

        })

      }


      const data =
        prepararDatos(
          solicitud
        )


      await crearNotificacion({

        solicitud,

        tipo:
          "DILIGENCIA_VENCIDA",

        destinatario:
          solicitud.tramitador,

        data

      })


      return res.json({

        ok: true,

        mensaje:
          "Notificación de diligencia VENCIDA agregada a BullMQ",

        solicitudId,

        tipo:
          "DILIGENCIA_VENCIDA"

      })

    } catch (error) {

      console.error(
        "❌ ERROR DILIGENCIA VENCIDA:",
        error
      )

      return res.status(500).json({

        ok: false,

        mensaje:
          error instanceof Error
            ? error.message
            : "Error ejecutando prueba"

      })

    }

  }
)


// ======================================================
// 🕗 TODAS LAS DILIGENCIAS DE HOY
// ======================================================

router.get(
  "/diligencias-hoy-todas",
  async (req, res) => {

    try {

      console.log("")
      console.log("==============================================")
      console.log("🕗 TODAS LAS DILIGENCIAS DE HOY")
      console.log("==============================================")


      // ==================================================
      // POSTGRESQL
      // FECHA DE NEGOCIO EN HORA COLOMBIA
      // ==================================================

      const [filas]: any =
        await db.query(`

          SELECT
              s.id

          FROM "SolicitudTramites" s

          INNER JOIN "Programacion" p
              ON p."solicitudTramiteId" = s.id

          WHERE
              s."estadoActualTramite" = 2

              AND
              p."fechaProbableEntrega"::date =
              (
                CURRENT_TIMESTAMP
                AT TIME ZONE 'America/Bogota'
              )::date

          ORDER BY
              p."fechaProbableEntrega" ASC

        `)


      const ids =
        filas.map(
          (fila: any) =>
            Number(fila.id)
        )


      console.log(
        "🕗 Solicitudes de HOY:",
        ids
      )


      // ==================================================
      // BUSCAR OBJETOS COMPLETOS
      // ==================================================

      const solicitudes: any[] = []


      for (
        const id
        of ids
      ) {

        const solicitud =
          await buscarSolicitud(id)


        if (solicitud) {

          solicitudes.push(
            solicitud
          )

        }

      }


      let agregadas = 0
      let errores = 0


      // ==================================================
      // ENVIAR TODAS
      // ==================================================

      for (
        const solicitud
        of solicitudes
      ) {

        try {

          if (
            !solicitud.tramitador?.numeroTramitador
          ) {

            console.log(
              `⚠️ Solicitud ${solicitud.id} sin WhatsApp`
            )

            errores++

            continue

          }


          const data =
            prepararDatos(
              solicitud
            )


          console.log("")
          console.log(
            "🕗 ENVIANDO:",
            solicitud.id
          )

          console.log(
            "👤:",
            data.nombre
          )

          console.log(
            "📱:",
            solicitud.tramitador.numeroTramitador
          )

          console.log(
            "📅:",
            data.fecha
          )


          await crearNotificacion({

            solicitud,

            tipo:
              "DILIGENCIA_HOY",

            destinatario:
              solicitud.tramitador,

            data

          })


          agregadas++


        } catch (error) {

          errores++

          console.error(
            `❌ Error solicitud ${solicitud.id}:`,
            error
          )

        }

      }


      return res.json({

        ok: true,

        mensaje:
          "Prueba de todas las diligencias de HOY ejecutada",

        fechaHoy:
          new Intl.DateTimeFormat(
            "en-CA",
            {
              timeZone:
                "America/Bogota"
            }
          ).format(
            new Date()
          ),

        encontradas:
          ids.length,

        solicitudes:
          ids,

        agregadasBullMQ:
          agregadas,

        errores

      })

    } catch (error) {

      console.error(
        "❌ ERROR GENERAL HOY:",
        error
      )

      return res.status(500).json({

        ok: false,

        mensaje:
          error instanceof Error
            ? error.message
            : "Error ejecutando prueba"

      })

    }

  }
)


// ======================================================
// 🚨 TODAS LAS DILIGENCIAS VENCIDAS
// ======================================================

router.get(
  "/diligencias-vencidas-todas",
  async (req, res) => {

    try {

      console.log("")
      console.log("==============================================")
      console.log("🚨 TODAS LAS DILIGENCIAS VENCIDAS")
      console.log("==============================================")


      // ==================================================
      // POSTGRESQL
      // FECHA DE NEGOCIO EN HORA COLOMBIA
      // ==================================================

      const [filas]: any =
        await db.query(`

          SELECT
              s.id

          FROM "SolicitudTramites" s

          INNER JOIN "Programacion" p
              ON p."solicitudTramiteId" = s.id

          WHERE
              s."estadoActualTramite" = 2

              AND
              p."fechaProbableEntrega"::date <
              (
                CURRENT_TIMESTAMP
                AT TIME ZONE 'America/Bogota'
              )::date

          ORDER BY
              p."fechaProbableEntrega" ASC

        `)


      const ids =
        filas.map(
          (fila: any) =>
            Number(fila.id)
        )


      console.log(
        "🚨 Solicitudes VENCIDAS:",
        ids
      )


      // ==================================================
      // BUSCAR OBJETOS COMPLETOS
      // ==================================================

      const solicitudes: any[] = []


      for (
        const id
        of ids
      ) {

        const solicitud =
          await buscarSolicitud(id)


        if (solicitud) {

          solicitudes.push(
            solicitud
          )

        }

      }


      let agregadas = 0
      let errores = 0


      // ==================================================
      // ENVIAR TODAS
      // ==================================================

      for (
        const solicitud
        of solicitudes
      ) {

        try {

          if (
            !solicitud.tramitador?.numeroTramitador
          ) {

            console.log(
              `⚠️ Solicitud ${solicitud.id} sin WhatsApp`
            )

            errores++

            continue

          }


          const data =
            prepararDatos(
              solicitud
            )


          console.log("")
          console.log(
            "🚨 ENVIANDO:",
            solicitud.id
          )

          console.log(
            "👤:",
            data.nombre
          )

          console.log(
            "📱:",
            solicitud.tramitador.numeroTramitador
          )

          console.log(
            "📅:",
            data.fecha
          )


          await crearNotificacion({

            solicitud,

            tipo:
              "DILIGENCIA_VENCIDA",

            destinatario:
              solicitud.tramitador,

            data

          })


          agregadas++


        } catch (error) {

          errores++

          console.error(
            `❌ Error solicitud ${solicitud.id}:`,
            error
          )

        }

      }


      return res.json({

        ok: true,

        mensaje:
          "Prueba de todas las diligencias VENCIDAS ejecutada",

        fechaHoy:
          new Intl.DateTimeFormat(
            "en-CA",
            {
              timeZone:
                "America/Bogota"
            }
          ).format(
            new Date()
          ),

        encontradas:
          ids.length,

        solicitudes:
          ids,

        agregadasBullMQ:
          agregadas,

        errores

      })

    } catch (error) {

      console.error(
        "❌ ERROR GENERAL VENCIDAS:",
        error
      )

      return res.status(500).json({

        ok: false,

        mensaje:
          error instanceof Error
            ? error.message
            : "Error ejecutando prueba"

      })

    }

  }
)


export default router