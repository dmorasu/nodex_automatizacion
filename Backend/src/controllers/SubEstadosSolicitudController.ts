import type { Request, Response } from "express"
import SubEstadosSolicitud from "../models/subEstadosSolicitud"



export class SubEstadosSolicitudController {

  static create = async(
    req:Request,
    res:Response
  ) => {

    try {

      const subEstado = new SubEstadosSolicitud(req.body)

      subEstado.solicitudTramiteId =
  req.solicitudTramites.id

      await subEstado.save()

      res.status(201).json(
        "Subestado registrado correctamente"
      )

    } catch(error){

      console.log(error)

      res.status(500).json({
        error:'Error al registrar subestado'
      })
    }
  }
}