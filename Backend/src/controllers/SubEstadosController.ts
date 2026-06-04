import { Request, Response } from "express"
import SubEstados from "../models/subEstados"

export class SubEstadosController {

  static getByTramite = async(
    req:Request,
    res:Response
  ) => {

    try {

      const { tramiteId } = req.params

      console.log("TRAMITE ID:", tramiteId)

      const subEstados = await SubEstados.findAll({
        where:{
          tramiteId
        },
        order:[
          ['nombre','ASC']
        ]
      })

      res.json(subEstados)

    } catch(error:any){

      console.log("ERROR:")
      console.log(error)

      console.log("MESSAGE:")
      console.log(error.message)

      console.log("PARENT:")
      console.log(error.parent)

      res.status(500).json({
        message:error.message,
        parent:error.parent
      })
    }
  }
}