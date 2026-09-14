import { Op, Sequelize } from "sequelize"

import SolicitudTramites from "../models/solicitudTramites"
import Programacion from "../models/programacion"
import Usuarios from "../models/usuarios"
import Tramitador from "../models/tramitador"
import Municipios from "../models/municipios"
import Clientes from "../models/clientes"
import Tramite from "../models/tramite"
import Estados from "../models/estados"


// ======================================================
// FECHA ACTUAL DE COLOMBIA
// ======================================================

const obtenerFechaColombia = (): string => {

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).format(new Date())

}


// ======================================================
// INCLUDES COMUNES
// ======================================================

const includesDiligencia = [

  // ====================================================
  // PROGRAMACIÓN
  // ====================================================

  {
    model: Programacion,
    as: "programacion",
    required: true
  },


  // ====================================================
  // USUARIO
  // ====================================================

  {
    model: Usuarios,
    as: "usuario",
    required: false
  },


  // ====================================================
  // TRAMITADOR
  // ====================================================

  {
    model: Tramitador,
    as: "tramitador",
    required: false
  },


  // ====================================================
  // MUNICIPIO
  // ====================================================

  {
    model: Municipios,
    as: "municipios",
    required: false
  },


  // ====================================================
  // CLIENTE
  // ====================================================

  {
    model: Clientes,
    as: "clientes",
    required: false
  },


  // ====================================================
  // TRÁMITE
  // ====================================================

  {
    model: Tramite,
    as: "tramite",
    required: false
  },


  // ====================================================
  // ESTADO ACTUAL
  // ====================================================

  {
    model: Estados,
    as: "estadoActual",
    required: false
  }

]


// ======================================================
// DILIGENCIAS PROGRAMADAS PARA HOY
// ======================================================

export const obtenerDiligenciasDeHoy =
  async () => {

    try {

      const fechaHoy =
        obtenerFechaColombia()


      console.log(
        "=============================================="
      )

      console.log(
        "🕗 BUSCANDO DILIGENCIAS PROGRAMADAS PARA HOY"
      )

      console.log(
        "🇨🇴 Fecha Colombia:",
        fechaHoy
      )

      console.log(
        "=============================================="
      )


      // ==================================================
      // CONSULTAR SOLICITUDES
      // ==================================================

      const diligencias =
        await SolicitudTramites.findAll({

          include: includesDiligencia,

          where: {

            // ============================================
            // ESTADO ACTUAL = 2
            // EN CURSO
            // ============================================

            estadoActualTramite: 2,

            // ============================================
            // FECHA PROBABLE DE ENTREGA = HOY
            //
            // La columna es timestamp with time zone,
            // pero la fecha de negocio se toma como DATE.
            // ============================================

            [Op.and]: [

              Sequelize.where(

                Sequelize.cast(
                  Sequelize.col(
                    "programacion.fechaProbableEntrega"
                  ),
                  "date"
                ),

                Op.eq,

                fechaHoy

              )

            ]

          }

        })


      // ==================================================
      // MOSTRAR RESULTADOS
      // ==================================================

      console.log(
        "📊 DILIGENCIAS DE HOY:",
        diligencias.map(
          solicitud => ({

            id:
              solicitud.id,

            fecha:
              solicitud
                .programacion
                ?.fechaProbableEntrega,

            estado:
              solicitud.estadoActualTramite

          })
        )
      )


      console.log(
        "📋 Diligencias encontradas:",
        diligencias.length
      )


      console.log(
        "🟢 Diligencias EN CURSO:",
        diligencias.length
      )


      // ==================================================
      // MOSTRAR DILIGENCIAS
      // ==================================================

      diligencias.forEach(

        solicitud => {

          console.log(
            `➡️ Solicitud ${solicitud.id}`
          )

          console.log(
            "   📅 Fecha:",
            solicitud
              .programacion
              ?.fechaProbableEntrega
          )

          console.log(
            "   👤 Tramitador:",
            solicitud
              .tramitador
              ?.nombreTramitador
          )

          console.log(
            "   📍 Dirección:",
            solicitud
              .direccionTramite
          )

          console.log(
            "   🔵 Estado:",
            solicitud
              .estadoActualTramite
          )

          console.log(
            "   🏷️ Nombre estado:",
            solicitud
              .estadoActual
              ?.nombreEstado
          )

        }

      )


      return diligencias

    } catch (error) {

      console.error(
        "❌ ERROR BUSCANDO DILIGENCIAS DE HOY:",
        error
      )

      throw error

    }

  }


// ======================================================
// DILIGENCIAS VENCIDAS
// ======================================================

export const obtenerDiligenciasVencidas =
  async () => {

    try {

      const fechaHoy =
        obtenerFechaColombia()

      const fechaLimiteVencida = new Date(fechaHoy);
      fechaLimiteVencida.setDate(fechaLimiteVencida.getDate() - 1);


      console.log(
        "=============================================="
      )

      console.log(
        "🚨 BUSCANDO DILIGENCIAS VENCIDAS"
      )

      console.log(
        "🇨🇴 Fecha Colombia:",
        fechaHoy
      )

      console.log(
        "=============================================="
      )


      // ==================================================
      // CONSULTAR SOLICITUDES VENCIDAS
      // ==================================================

      const diligencias =
        await SolicitudTramites.findAll({

          include: includesDiligencia,

          where: {

            // ============================================
            // ESTADO ACTUAL = 2
            // EN CURSO
            // ============================================

            estadoActualTramite: 2,

            // ============================================
            // FECHA PROBABLE ANTERIOR A HOY
            // ============================================

            [Op.and]: [

              Sequelize.where(

                Sequelize.cast(
                  Sequelize.col(
                    "programacion.fechaProbableEntrega"
                  ),
                  "date"
                ),

                Op.lt,

                fechaLimiteVencida

              )

            ]

          }

        })


      // ==================================================
      // MOSTRAR RESULTADOS
      // ==================================================

      console.log(
        "📊 DILIGENCIAS VENCIDAS:",
        diligencias.map(
          solicitud => ({

            id:
              solicitud.id,

            fecha:
              solicitud
                .programacion
                ?.fechaProbableEntrega,

            estado:
              solicitud.estadoActualTramite

          })
        )
      )


      console.log(
        "📋 Diligencias vencidas:",
        diligencias.length
      )


      // ==================================================
      // MOSTRAR DILIGENCIAS
      // ==================================================

      diligencias.forEach(

        solicitud => {

          console.log(
            `➡️ Solicitud ${solicitud.id}`
          )

          console.log(
            "   📅 Fecha programación:",
            solicitud
              .programacion
              ?.fechaProbableEntrega
          )

          console.log(
            "   👤 Tramitador:",
            solicitud
              .tramitador
              ?.nombreTramitador
          )

          console.log(
            "   📍 Dirección:",
            solicitud
              .direccionTramite
          )

          console.log(
            "   🔵 Estado:",
            solicitud
              .estadoActualTramite
          )

          console.log(
            "   🏷️ Nombre estado:",
            solicitud
              .estadoActual
              ?.nombreEstado
          )

        }

      )


      return diligencias

    } catch (error) {

      console.error(
        "❌ ERROR BUSCANDO DILIGENCIAS VENCIDAS:",
        error
      )

      throw error

    }

  }