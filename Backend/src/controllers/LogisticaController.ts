import type { Request, Response } from 'express'

import Logistica from '../models/logistica'
import SolicitudTramites from '../models/solicitudTramites'
import Transportadora from '../models/trasnportadora'
import Usuarios from '../models/usuarios'
import Tramite from '../models/tramite'

import {
  crearNotificacion
} from '../services/notificacionesServices'
import { erroresLogistica, esSi, registraEntrega, valorAGuardar } from '../services/reglasLogistica'

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

      // Reglas (services/reglasLogistica.ts) sobre cómo quedaría guardada: lo que llega y, si no
      // llega, lo que ya tiene
      const queda = (campo: 'pagoContraEntrega' | 'valorEnvio' | 'fechaProgramacionLogistica') =>
        req.body[campo] !== undefined ? req.body[campo] : logistica?.[campo] ?? null
      const pagoContraEntrega = esSi(queda('pagoContraEntrega'))
      const errores = erroresLogistica({
        pagoContraEntrega,
        valorEnvio: queda('valorEnvio'),
        fechaProgramacionLogistica: queda('fechaProgramacionLogistica')
      })
      if (errores.length) return res.status(400).json({ error: errores.join('. ') })
      const valorEnvio = valorAGuardar(pagoContraEntrega, queda('valorEnvio'))

      // Si este guardado registra la entrega de la transportadora, sale "Envío entregado" (hook del
      // modelo) en lugar del correo de logística
      const registraLaEntrega = registraEntrega(logistica?.fechaEntregaTransportadora ?? null,
        req.body.fechaEntregaTransportadora !== undefined ? req.body.fechaEntregaTransportadora : logistica?.fechaEntregaTransportadora)


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

            pagoContraEntrega,

            valorEnvio,

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


        logistica.pagoContraEntrega = pagoContraEntrega
        logistica.valorEnvio = valorEnvio


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
      // CONVERTIR A OBJETO PLANO
      // =====================================

      const logisticaData =
        logisticaCompleta
          ? logisticaCompleta.toJSON()
          : null


      // =====================================
      // CARGAR SOLICITUD
      // =====================================

      const solicitud =
        await SolicitudTramites.findByPk(
          solicitudId,
          {
            include: [
              Usuarios,
              Tramite
            ]
          }
        )


      // =====================================
      // LOGS
      // =====================================

      console.log(
        '📦 LOGÍSTICA:',
        logisticaData
      )

      console.log(
        '🚛 TRANSPORTADORA:',
        logisticaData?.transportadora
      )

      console.log(
        '🚛 NOMBRE TRANSPORTADORA:',
        logisticaData?.transportadora
          ?.nombreTransportadora
      )


      // =====================================
      // ENVIAR NOTIFICACIÓN
      // =====================================

      if (
        solicitud &&
        solicitud.usuario &&
        logisticaData &&
        !registraLaEntrega
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
              logisticaData.numeroGuia ||
              'N/A',

            valorEnvio:
              logisticaData.pagoContraEntrega
                ? 'Contra entrega'
                : logisticaData.valorEnvio ||
                  'N/A',

            // 🚛 AHORA SE TOMA DEL OBJETO PLANO
            transportadora:
              logisticaData.transportadora
                ?.nombreTransportadora ||
              'N/A',

            destinatario:
              logisticaData.destinatario ||
              'N/A',

            fechaProbableEntrega:
              logisticaData
                .fechaProgramacionLogistica ||
              'N/A',

            fechaEntregaTransportadora:
              logisticaData
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