import type { Request,Response } from "express";
import Trazabilidad from "../models/trazabilidad";
import SolicitudTramites from "../models/solicitudTramites";
import Usuarios from "../models/usuarios";
import { crearNotificacion } from "../services/notificacionesServices";
import EstadosTramites from "../models/estadosTramites";
import Estados from "../models/estados";

declare global{
    namespace Express{
        interface Request{
            trazabilidad?:Trazabilidad       
        }
    }
}

export class TrazabilidadController{
    static getAll =async (req: Request, res:Response) =>{
        
    }

    static create = async (req: Request, res: Response) => {
  try {

    const trazabilidad = new Trazabilidad(req.body)
    trazabilidad.solicitudTramiteId = req.solicitudTramites.id

    await trazabilidad.save()

    const solicitud = await SolicitudTramites.findByPk(
      req.solicitudTramites.id,
      { include: [Usuarios] }
    )
    const ultimoEstado = await EstadosTramites.findOne({
  where: {
    solicitudTramiteId: req.solicitudTramites.id
  },
  include: [Estados],
  order: [['createdAt', 'DESC']]
})

    if (solicitud?.usuario?.correoUsuario) {
      /* crearNotificacion({
        solicitud,
        tipo: 'TRAZABILIDAD',
        destinatario: solicitud.usuario,
        data: {
          observacion: trazabilidad.observacionTrazabilidad, // 🔥 CLAVE
          estado: ultimoEstado?.estado?.nombreEstado || 'Sin estado'
        }
      }).catch(console.error) */
    }

    return res.status(201).json('Registro Guardado')

  } catch (error) {
    return res.status(500).json({ error: "Hubo un error" })
  }
}


    static getById =async (req: Request, res:Response) =>{
        res.json(req.trazabilidad)

    }

    static updateById =async (req: Request, res:Response) =>{
        req.trazabilidad.update(req.body)
        res.json("Se actualizo el registro")

    }

    static deleteById =async (req: Request, res:Response) =>{
        await req.trazabilidad.destroy()
        res.json('Registro Eliminado')

    }

}