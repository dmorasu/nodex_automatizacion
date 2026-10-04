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
import Clientes from "../models/clientes"
import { cambiarEstadoTramite } from "../services/estadoTramite"

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

  // La lógica (estado actual, finalización y notificaciones) está en services/estadoTramite.ts,
  // la misma que usan el cargue por Excel y la gestión masiva en pantalla
  static create = async (
    req: Request,
    res: Response
  ) => {
    try {
      const { esFinalizado } = await cambiarEstadoTramite({
        solicitudTramiteId: req.solicitudTramites.id,
        estadoId: Number(req.body.estadoId),
        tipoRechazoId: req.body.tipoRechazoId ? Number(req.body.tipoRechazoId) : null
      })

      return res.status(201).json({
        success: true,
        requiereEvaluacion: esFinalizado
      })
    } catch (error: any) {
      console.error("❌ ERROR EN CREATE ESTADO:", error)
      return res.status(500).json({
        success: false,
        error: "Error al actualizar el estado del trámite",
        detalle: process.env.NODE_ENV === "development" ? error.message : undefined
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