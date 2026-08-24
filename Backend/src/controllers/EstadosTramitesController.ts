import type { Request, Response } from "express"
import { db } from "../config/db"

import SolicitudTramites from "../models/solicitudTramites"
import EstadosTramites from "../models/estadosTramites"
import Programacion from "../models/programacion"
import Estados from "../models/estados"
import Usuarios from "../models/usuarios"
import { crearNotificacion } from "../services/notificacionesServices"
import Tramitador from "../models/tramitador"
import Trazabilidad from "../models/trazabilidad"
import Municipios from "../models/municipios"
import Operaciones from "../models/operaciones"
import { fechaColombia } from "../utils/fechaColombia"
import TiposRechazo from "../models/tiposRechazos"
import Tramite from "../models/tramite"

declare global {
  namespace Express {
    interface Request {
      estadosTramites?: EstadosTramites
    }
  }
}

export class EstadosTramitesController {

  static getAll = async (
    req: Request,
    res: Response
  ) => {

  }

  static create = async (
    req: Request,
    res: Response
  ) => {

    const transaction = await db.transaction()

    // Controlamos manualmente si la transacción
    // ya fue confirmada
    let transactionFinalizada = false

    try {

      

      // ========================================
      // CREAR NUEVO ESTADO
      // ========================================

      const estadosTramites =
        new EstadosTramites(req.body)

      estadosTramites.solicitudTramiteId =
        req.solicitudTramites.id

      console.log("📝 GUARDANDO ESTADO:", {
        solicitudTramiteId:
          estadosTramites.solicitudTramiteId,

        estadoId:
          estadosTramites.estadoId,

        tipoRechazoId:
          estadosTramites.tipoRechazoId
      })

      await estadosTramites.save({
        transaction
      })

      console.log(
        "✅ ESTADO GUARDADO. ID:",
        estadosTramites.id
      )

      // ========================================
      // CONSULTAR ESTADO
      // ========================================

      const estado = await Estados.findByPk(
        estadosTramites.estadoId,
        {
          transaction
        }
      )

      console.log(
        "🔎 ESTADO:",
        estado?.nombreEstado
      )

      const esFinalizado =
        Number(estadosTramites.estadoId) === 6 ||
        estado?.nombreEstado
          ?.toLowerCase()
          .trim() === "finalizado"

      console.log(
        "🏁 ES FINALIZADO:",
        esFinalizado
      )

      // ========================================
      // CARGAR SOLICITUD
      // ========================================

      const solicitud =
        await SolicitudTramites.findByPk(
          estadosTramites.solicitudTramiteId,
          {
            include: [
              Usuarios,
              Tramitador,
              Municipios,
              Operaciones,
              Tramite
            ],
            transaction
          }
        )

      if (!solicitud) {
        throw new Error(
          "No se encontró la solicitud del trámite"
        )
      }

      console.log("📋 SOLICITUD CARGADA:", {
        id: solicitud.id,
        usuarioId: solicitud.usuarioId,
       
        usuario:
          solicitud.usuario?.nombreUsuario || "N/A",
        operacion:
          solicitud.operaciones?.nombreOperacion || "N/A",
        tramite:
          solicitud.tramite?.nombreTramite || "N/A"
      })

      // ========================================
      // SI EL ESTADO ES FINALIZADO
      // ========================================

      if (esFinalizado) {

        console.log(
          "🏁 PROCESANDO FINALIZACIÓN"
        )

        const fechaActual = new Date()

        const programacion =
          await Programacion.findOne({
            where: {
              solicitudTramiteId:
                estadosTramites.solicitudTramiteId
            },
            transaction
          })

        if (programacion) {

          console.log(
            "📅 ACTUALIZANDO PROGRAMACIÓN:",
            programacion.id
          )

          programacion.fechaFinalizacionServicio =
            fechaActual

          await programacion.save({
            transaction
          })

          console.log(
            "✅ PROGRAMACIÓN ACTUALIZADA"
          )

        } else {

          console.log(
            "📅 CREANDO PROGRAMACIÓN"
          )

          await Programacion.create(
            {
              solicitudTramiteId:
                estadosTramites.solicitudTramiteId,

              fechaFinalizacionServicio:
                fechaActual
            },
            {
              transaction
            }
          )

          console.log(
            "✅ PROGRAMACIÓN CREADA"
          )
        }
      }

      // ========================================
      // CONFIRMAR TRANSACCIÓN
      // ========================================

      await transaction.commit()

      transactionFinalizada = true

      console.log(
        "💾 TRANSACCIÓN CONFIRMADA"
      )

      // ========================================
      // CONSULTAR TIPO DE RECHAZO
      // ========================================

      const estadoConRechazo =
        await EstadosTramites.findByPk(
          estadosTramites.id,
          {
            include: [
              TiposRechazo
            ]
          }
        )

      console.log(
        "🔎 ESTADO CON RECHAZO CONSULTADO"
      )

      // ========================================
      // CONSULTAR ÚLTIMA TRAZABILIDAD
      // ========================================

      const ultimaTrazabilidad =
        await Trazabilidad.findOne({
          where: {
            solicitudTramiteId:
              solicitud.id
          },
          order: [
            ["createdAt", "DESC"]
          ]
        })

      
      // ========================================
      // LOG GENERAL DE NOTIFICACIONES
      // ========================================

      

      // ========================================
      // NOTIFICACIÓN:
      // EN ESPERA POR NOVEDAD
      // ========================================

      if (
        Number(estadosTramites.estadoId) === 3 &&
        solicitud.usuario
      ) {

        console.log(
          "⚠️ GENERANDO NOTIFICACIÓN DE NOVEDAD"
        )

        await crearNotificacion({
          solicitud,
          tipo: "EN_ESPERA_POR_NOVEDAD",
          destinatario: solicitud.usuario,
          data: {
            estadoId:
              Number(estadosTramites.estadoId),

            nombre:
              solicitud.usuario.nombreUsuario,

            tipo:
              solicitud.tramite?.nombreTramite ||
              "N/A",

            novedad:
              ultimaTrazabilidad
                ?.observacionTrazabilidad ||
              "Sin observaciones",

            tipoRechazo:
              estadoConRechazo
                ?.tipoRechazo
                ?.nombre ||
              "Sin tipo de rechazo",

            tramitador:
              solicitud.municipios.responsable ||
              "N/A",

            municipio:
              solicitud.municipios
                ?.nombreMunicipio ||
              "N/A",

            programador:
              solicitud.municipios
                ?.responsable ||
              "N/A",

            operacion:
              solicitud.operaciones
                ?.nombreOperacion ||
              "N/A"
          }
        })

        console.log(
          "✅ NOTIFICACIÓN DE NOVEDAD CREADA"
        )

      } else {

        console.log(
          "ℹ️ NO APLICA NOTIFICACIÓN DE NOVEDAD"
        )
      }

      // ========================================
      // NOTIFICACIÓN:
      // FINALIZADO
      // ========================================

      if (
        esFinalizado &&
        solicitud.usuario
      ) {

        console.log(
          "🏁 GENERANDO NOTIFICACIÓN FINALIZADO"
        )

        await crearNotificacion({
          solicitud,
          tipo: "FINALIZADO",
          destinatario: solicitud.usuario,
          data: {
            nombre:
              solicitud.usuario.nombreUsuario,

            fecha:
              fechaColombia(),

            tramitador:
              solicitud.tramitador
                ?.nombreTramitador ||
              "N/A",

            municipio:
              solicitud.municipios
                ?.nombreMunicipio ||
              "N/A",

            operacion:
              solicitud.operaciones
                ?.nombreOperacion ||
              "N/A",

            tipo:
              solicitud.tramite
                ?.nombreTramite ||
              "N/A",

            programador:
              solicitud.municipios
                ?.responsable ||
              "N/A",

            resultado:
              ultimaTrazabilidad
                ?.observacionTrazabilidad ||
              "Sin observaciones"
          }
        })

        console.log(
          "✅ NOTIFICACIÓN FINALIZADO CREADA"
        )

      } else {

        console.log(
          "ℹ️ NO APLICA NOTIFICACIÓN FINALIZADO"
        )
      }

      console.log("========================================")
      console.log("🎉 PROCESO TERMINADO CORRECTAMENTE")
      console.log("========================================")

      return res.status(201).json({
        success: true,
        requiereEvaluacion: esFinalizado
      })

    } catch (error: any) {

      console.error("========================================")
      console.error(
        "❌ ERROR EN CREATE ESTADO"
      )
      console.error(
        error.message
      )
      console.error(
        error
      )
      console.error("========================================")

      // Solo hacemos rollback si todavía
      // no se confirmó la transacción
      if (!transactionFinalizada) {

        try {

          await transaction.rollback()

          console.log(
            "↩️ ROLLBACK REALIZADO"
          )

        } catch (rollbackError) {

          console.error(
            "❌ ERROR HACIENDO ROLLBACK:",
            rollbackError
          )
        }
      }

      return res.status(500).json({
        success: false,

        error:
          "Error al actualizar el estado del trámite",

        detalle:
          process.env.NODE_ENV === "development"
            ? error.message
            : undefined
      })
    }
  }

  static getById = async (
    req: Request,
    res: Response
  ) => {

    res.json(
      req.estadosTramites
    )
  }

  static updateById = async (
    req: Request,
    res: Response
  ) => {

    await req.estadosTramites.update(
      req.body
    )

    res.json(
      "Se actualizó el registro"
    )
  }

  static deleteById = async (
    req: Request,
    res: Response
  ) => {

    await req.estadosTramites.destroy()

    res.json(
      "Registro Eliminado"
    )
  }
}