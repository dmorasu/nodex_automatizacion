import type { Request,Response } from "express";
import Programacion from "../models/programacion";
import { crearNotificacion } from "../services/notificacionesServices";
import SolicitudTramites from "../models/solicitudTramites";
import Usuarios from "../models/usuarios";
import Municipios from "../models/municipios";
import Tramite from "../models/tramite";
import Operaciones from "../models/operaciones";
import Tramitador from "../models/tramitador";

declare global{
    namespace Express{
        interface Request{
            programacion?:Programacion      
        }
    }
}

export class ProgramacionController{
    static getAll =async (req: Request, res:Response) =>{
        
    }

    static create = async (req: Request, res: Response) => {
  try {

    const solicitudId = req.solicitudTramites.id

    let programacion = await Programacion.findOne({
      where: { solicitudTramiteId: solicitudId }
    })

    if (!programacion) {
     programacion = await Programacion.create({
  solicitudTramiteId: solicitudId,
  fechaProbableEntrega: req.body.fechaProbableEntrega || null,
  valorTramite: req.body.valorTramite || null,
  valorViaticos: req.body.valorViaticos || null,
  conceptoHonorarios: req.body.conceptoHonorarios || null,
  conceptoViaticos: req.body.conceptoViaticos || null,

  requiereCita: req.body.requiereCita || false,
  fechaCita: req.body.fechaCita || null,
  horaCita: req.body.horaCita || null
})
    
    } else {
      Object.assign(programacion, req.body)
      await programacion.save()
    }

    // 🔥 cargar usuario
    const solicitud = await SolicitudTramites.findByPk(
      solicitudId,
      { include: [Usuarios,Municipios,Tramite,Operaciones,Tramitador] }
    )

    // 🔔 NOTIFICACIÓN
    if (solicitud?.usuario?.correoUsuario) {
      await crearNotificacion({
  solicitud,
  tipo: 'PROGRAMACION',
  destinatario: solicitud.usuario,
  data: {
    nombre: solicitud.usuario.nombreUsuario,
    tipo: solicitud.tramite.nombreTramite,
    fecha: programacion.fechaProbableEntrega
      ? new Date(programacion.fechaProbableEntrega).toLocaleDateString()
      : 'Sin fecha',
    tramitador: solicitud.tramitador?.nombreTramitador || 'N/A',
    municipio: solicitud.municipios?.nombreMunicipio|| 'N/A',
    operacion: solicitud.operaciones.nombreOperacion||'N/A',
    programador: solicitud.tramite.responsable
  }
})
    }

    return res.status(201).json("Programación guardada correctamente")

  } catch (error) {
    console.error("ERROR PROGRAMACION:", error)
    return res.status(500).json("Hubo un error")
  }
}




    static getById =async (req: Request, res:Response) =>{
        res.json(req.programacion)

    }

    static updateById =async (req: Request, res:Response) =>{
        req.programacion.update(req.body)
        res.json("Se actualizo el registro")

    }

    static deleteById =async (req: Request, res:Response) =>{
        await req.programacion.destroy()
        res.json('Registro Eliminado')

    }

    

}