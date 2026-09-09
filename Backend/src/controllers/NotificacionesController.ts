import type { Request, Response } from 'express'
import Notificacion from '../models/notificaciones'

export class NotificacionesController {

  static obtenerPorSolicitud = async (req: Request, res: Response) => {

    try {

      const { solicitudTramiteId } = req.params

      const notificaciones = await Notificacion.findAll({
        where: {
          solicitudTramiteId: Number(solicitudTramiteId),
          canal: 'WHATSAPP'
        },
        order: [['createdAt', 'DESC']]
      })

      res.json(notificaciones)

    } catch (error) {

      console.error(
        'ERROR AL OBTENER NOTIFICACIONES WHATSAPP:',
        error
      )

      res.status(500).json({
        error: 'Error al obtener las notificaciones'
      })
    }
  }

}