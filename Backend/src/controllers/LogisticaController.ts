import type { Request, Response } from 'express'

import Logistica from '../models/logistica'
import SolicitudTramites from '../models/solicitudTramites'
import Transportadora from '../models/trasnportadora'
import Usuarios from '../models/usuarios'
import Tramite from '../models/tramite'

import {
  crearNotificacion
} from '../services/notificacionesServices'

declare global {
  namespace Express {
    interface Request {
      logistica?: Logistica
    }
  }
}

export class LogisticaController {

  static getAll = async (
    req: Request,
    res: Response
  ) => {

    try {

      const logistica = await Logistica.findAll({
        order: [
          ['createdAt', 'DESC']
        ],
        include: [
          Transportadora
        ]
      })

      res.json(logistica)

    } catch (error) {

      console.log(error)

      res.status(500).json({
        error: 'Error al consultar todas las logísticas'
      })

    }
  }


  static create = async (
    req: Request,
    res: Response
  ) => {

    try {

      const solicitudId =
        req.solicitudTramites.id

      let logistica =
        await Logistica.findOne({

          where: {
            solicitudTramiteId:
              solicitudId
          }

        })


      // =====================================
      // CREAR LOGÍSTICA
      // =====================================

      if (!logistica) {

        logistica =
          await Logistica.create({

            solicitudTramiteId:
              solicitudId,

            numeroGuia:
              req.body.numeroGuia || null,

            valorEnvio:
              req.body.valorEnvio || null,

            destinatario:
              req.body.destinatario || null,

            transportadoraId:
              req.body.transportadoraId
                ? Number(
                    req.body.transportadoraId
                  )
                : null,

            fechaProgramacionLogistica:
              req.body.fechaProgramacionLogistica ||
              null,

            fechaEntregaTransportadora:
              req.body.fechaEntregaTransportadora ||
              null

          })

      } else {

        // =====================================
        // ACTUALIZAR LOGÍSTICA
        // =====================================

        if (
          req.body.numeroGuia !== undefined
        ) {

          logistica.numeroGuia =
            req.body.numeroGuia || null

        }


        if (
          req.body.valorEnvio !== undefined
        ) {

          logistica.valorEnvio =
            req.body.valorEnvio || null

        }


        if (
          req.body.destinatario !== undefined
        ) {

          logistica.destinatario =
            req.body.destinatario || null

        }


        if (
          req.body.transportadoraId !== undefined
        ) {

          logistica.transportadoraId =
            req.body.transportadoraId
              ? Number(
                  req.body.transportadoraId
                )
              : null

        }


        if (
          req.body.fechaProgramacionLogistica !==
          undefined
        ) {

          logistica.fechaProgramacionLogistica =
            req.body.fechaProgramacionLogistica ||
            null

        }


        if (
          req.body.fechaEntregaTransportadora !==
          undefined
        ) {

          logistica.fechaEntregaTransportadora =
            req.body.fechaEntregaTransportadora ||
            null

        }


        await logistica.save()

      }


      // =====================================
      // RECARGAR LOGÍSTICA CON TRANSPORTADORA
      // =====================================

      const logisticaCompleta =
        await Logistica.findByPk(
    logistica.id,
    {
      include: [
        {
          model: Transportadora,
          as: 'transportadora'
        }
      ]
    }
  )


      // =====================================
      // CARGAR SOLICITUD
      // =====================================

      const solicitud =
        await SolicitudTramites.findByPk(
          solicitudId,
          {
            include: [
              Usuarios,
              Tramite,
            
            ]
          }
        )


      console.log(
        '📦 LOGÍSTICA:',
        logisticaCompleta?.toJSON()
      )

      console.log(
        '🚛 TRANSPORTADORA:',
        logisticaCompleta?.transportadora
      )


      // =====================================
      // ENVIAR NOTIFICACIÓN
      // =====================================

      if (
        solicitud &&
        solicitud.usuario &&
        logisticaCompleta
      ) {

        await crearNotificacion({

          solicitud,

          tipo: 'LOGISTICA',

          destinatario:
            solicitud.usuario,

          data: {

            nombre:
              solicitud.usuario.nombreUsuario,

            tipo:
              solicitud.tramite
                ?.nombreTramite ||
              'N/A',

            numeroGuia:
              logisticaCompleta.numeroGuia ||
              'N/A',

            valorEnvio:
              logisticaCompleta.valorEnvio ||
              'N/A',

            transportadora:
              logisticaCompleta.transportadora
                ?.nombreTransportadora ||
              'N/A',

            destinatario:
              logisticaCompleta.destinatario ||
              'N/A',

            fechaProbableEntrega:
              logisticaCompleta
                .fechaProgramacionLogistica ||
              'N/A',

            fechaEntregaTransportadora:
              logisticaCompleta
                .fechaEntregaTransportadora ||
              'N/A'

          }

        })

      }


      return res.status(201).json(
        'Logística guardada correctamente'
      )

    } catch (error) {

      console.error(
        'ERROR LOGISTICA:',
        error
      )

      return res.status(500).json({

        error:
          'No se pudo almacenar la logística'

      })

    }

  }


  static getById = async (
    req: Request,
    res: Response
  ) => {

    res.json(
      req.logistica
    )

  }


  static updateById = async (
    req: Request,
    res: Response
  ) => {

    await req.logistica?.update(
      req.body
    )

    res.json(
      'Logística actualizada'
    )

  }


  static deleteById = async (
    req: Request,
    res: Response
  ) => {

    await req.logistica?.destroy()

    res.json(
      'Logística eliminada'
    )

  }

}