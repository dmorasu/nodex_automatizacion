import type { Request, Response } from "express";
import Programacion from "../models/programacion";
import { notificarProgramacion } from "../services/notificacionesProgramacion";


declare global {
  namespace Express {
    interface Request {
      programacion?: Programacion
    }
  }
}

export class ProgramacionController {
  static getAll = async (req: Request, res: Response) => {

  }

  static create = async (req: Request, res: Response) => {
  try {

    const solicitudId = req.solicitudTramites.id

    let programacion = await Programacion.findOne({
      where: { solicitudTramiteId: solicitudId }
    })

    // ==========================================
    // FECHAS ANTES DE MODIFICAR LA PROGRAMACIÓN
    // ==========================================

    const fechaAnterior = programacion?.fechaProbableEntrega || null
    const nuevaFecha = req.body.fechaProbableEntrega || null

    let enviarNotificacionAsignado = false


    // ==========================================
    // CREAR / ACTUALIZAR PROGRAMACIÓN
    // ==========================================

    if (!programacion) {

      // Primera vez
      programacion = await Programacion.create({
        solicitudTramiteId: solicitudId,
        fechaProbableEntrega: nuevaFecha,
        valorTramite: req.body.valorTramite || null,
        valorViaticos: req.body.valorViaticos || null,
        conceptoHonorarios: req.body.conceptoHonorarios || null,
        conceptoViaticos: req.body.conceptoViaticos || null,

        requiereCita: req.body.requiereCita || false,
        fechaCita: req.body.fechaCita || null,
        horaCita: req.body.horaCita || null
      })

      // No existía fecha anteriormente
      // y ahora estamos guardando una
      if (!fechaAnterior && nuevaFecha) {
        enviarNotificacionAsignado = true
      }

    } else {

      // ==========================================
      // COMPARAR FECHA ANTERIOR VS NUEVA
      // ==========================================

      if (
        nuevaFecha &&
        (
          !fechaAnterior ||
          new Date(nuevaFecha).getTime() >
          new Date(fechaAnterior).getTime()
        )
      ) {
        enviarNotificacionAsignado = true
      }

      // Actualizar demás campos
      Object.assign(programacion, req.body)

      await programacion.save()
    }


    console.log('Fecha anterior:', fechaAnterior)
    console.log('Nueva fecha:', nuevaFecha)
    console.log(
      'Enviar ASIGNADO:',
      enviarNotificacionAsignado
    )


    await notificarProgramacion(solicitudId, { avisarAsignado: enviarNotificacionAsignado })


    return res
      .status(201)
      .json("Programación guardada correctamente")

  } catch (error) {

    console.error("ERROR PROGRAMACION:", error)

    return res
      .status(500)
      .json("Hubo un error")
  }
}

  static getById = async (req: Request, res: Response) => {
    res.json(req.programacion)

  }

  static updateById = async (req: Request, res: Response) => {
    req.programacion.update(req.body)
    res.json("Se actualizo el registro")

  }

  static deleteById = async (req: Request, res: Response) => {
    await req.programacion.destroy()
    res.json('Registro Eliminado')

  }



}