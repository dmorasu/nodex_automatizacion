import type { Request,Response } from "express";
import { db } from "../config/db"
import SolicitudTramites from '../models/solicitudTramites'
import EstadosTramites from "../models/estadosTramites";
import Programacion from "../models/programacion";
import Estados from "../models/estados"
import Usuarios from '../models/usuarios'
import { crearNotificacion } from '../services/notificacionesServices'
import Tramitador from "../models/tramitador";
import SubEstadosSolicitud from '../models/subEstadosSolicitud'
import SubEstados from '../models/subEstados'
import Trazabilidad from '../models/trazabilidad'
import Municipios from "../models/municipios";
import Operaciones from "../models/operaciones";

declare global{
    namespace Express{
        interface Request{
            estadosTramites?:EstadosTramites     
        }
    }
}

export class EstadosTramitesController{
    static getAll =async (req: Request, res:Response) =>{
        
    }

 static create = async (req: Request, res: Response) => {

  const transaction = await db.transaction()

  try {
    const estadosTramites = new EstadosTramites(req.body)
    estadosTramites.solicitudTramiteId = req.solicitudTramites.id

    await estadosTramites.save({ transaction })
    

    const estado = await Estados.findByPk(
      estadosTramites.estadoId,
      { transaction }
    )

    const esFinalizado =
      Number(estadosTramites.estadoId) === 6 ||
      estado?.nombreEstado?.toLowerCase() === "finalizado"

    // 🔥 CAMBIO: cargar solicitud SIEMPRE
    let solicitud: SolicitudTramites | null = await SolicitudTramites.findByPk(
      estadosTramites.solicitudTramiteId,
      {
        include: [Usuarios,Tramitador,Municipios,Operaciones],
        transaction
      }
    )

    if (esFinalizado) {

      const fechaActual = new Date()

      const programacion = await Programacion.findOne({
        where: {
          solicitudTramiteId: estadosTramites.solicitudTramiteId
        },
        transaction
      })

      if (programacion) {
        programacion.fechaFinalizacionServicio = fechaActual
        await programacion.save({ transaction })
      } else {
        await Programacion.create(
          {
            solicitudTramiteId: estadosTramites.solicitudTramiteId,
            fechaFinalizacionServicio: fechaActual
          },
          { transaction }
        )
      }
    }

    await transaction.commit()
    const ultimoSubEstado = await SubEstadosSolicitud.findOne({
  where: {
    solicitudTramiteId: solicitud.id
  },
  include: [SubEstados],
  order: [['createdAt', 'DESC']]
})

const ultimaTrazabilidad = await Trazabilidad.findOne({
  where: {
    solicitudTramiteId: solicitud.id
  },
  order: [['createdAt', 'DESC']]
})

const novedadTexto = `
Subestado: ${ultimoSubEstado?.subEstado?.nombre || 'Sin subestado'}

Observación: ${ultimaTrazabilidad?.observacionTrazabilidad || 'Sin observación'}
`

    await crearNotificacion({
  solicitud,
  tipo: 'CAMBIO_ESTADO',
  destinatario: solicitud.usuario,
  data: {
    estadoId: estado.id,
    estado: estado.nombreEstado,
    nombre: solicitud.usuario.nombreUsuario,
    fecha: new Date().toLocaleDateString(),
    tramitador: solicitud.tramitador?.nombreTramitador || 'N/A',
    municipio: solicitud.municipios?.nombreMunicipio|| 'N/A',
    operacion: solicitud.operaciones?.nombreOperacion || 'N/A',
    programador: solicitud.usuario.nombreUsuario,
    novedad: novedadTexto
  }
})

    // =========================
    // 🔔 NOTIFICACIÓN (EMAIL)
    // =========================
    if (esFinalizado && solicitud?.usuario) {

      crearNotificacion({
        solicitud,
        tipo: 'FINALIZADO',
        destinatario: solicitud.usuario // ✔ CORRECTO
      }).catch(console.error)
    }

      

    return res.status(201).json({
      success: true,
      requiereEvaluacion: esFinalizado
    })

  } catch (error: any) {

    await transaction.rollback()

    console.error("ERROR CREATE ESTADO:", error)

    return res.status(500).json({
      success: false,
      error: "Error al actualizar el estado del trámite",
      detalle: process.env.NODE_ENV === "development"
        ? error.message
        : undefined
    })
  }
}
    static getById =async (req: Request, res:Response) =>{
        res.json(req.estadosTramites)

    }

    static updateById =async (req: Request, res:Response) =>{
        req.estadosTramites.update(req.body)
        res.json("Se actualizo el registro")

    }

    static deleteById =async (req: Request, res:Response) =>{
        await req.estadosTramites.destroy()
        res.json('Registro Eliminado')

    }

}