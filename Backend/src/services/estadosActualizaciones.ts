import { db } from '../config/db'
import EstadosTramites from '../models/estadosTramites'
import Programacion from '../models/programacion'
import SolicitudTramites from '../models/solicitudTramites'
import Usuarios from '../models/usuarios'
import Tramitador from '../models/tramitador'
import Municipios from '../models/municipios'
import Operaciones from '../models/operaciones'
import Tramite from '../models/tramite'
import Trazabilidad from '../models/trazabilidad'

import { crearNotificacion } from './notificacionesServices'
import { fechaColombia } from '../utils/fechaColombia'

export const procesarEstados = async (data: any[]) => {

  const t = await db.transaction()
  const errores: any[] = []

  try {

    for (let i = 0; i < data.length; i++) {

      const row = data[i]
      const fila = i + 2

      try {

        // =========================
        // INSERTAR ESTADO
        // =========================
        await EstadosTramites.create(
          {
            solicitudTramiteId: row.solicitudTramiteId,
            estadoId: row.estadoId
          },
          { transaction: t }
        )

        // =========================
        // FINALIZADO
        // =========================
        if (Number(row.estadoId) === 6) {

          const ahora = new Date()

          const existeProgramacion = await Programacion.findOne({
            where: {
              solicitudTramiteId: row.solicitudTramiteId
            },
            transaction: t
          })

          if (existeProgramacion) {

            await existeProgramacion.update(
              {
                fechaFinalizacionServicio: ahora
              },
              { transaction: t }
            )

          } else {

            await Programacion.create(
              {
                solicitudTramiteId: row.solicitudTramiteId,
                fechaFinalizacionServicio: ahora
              },
              { transaction: t }
            )
          }

          // =========================
          // NOTIFICACIÓN FINALIZADO
          // =========================
          const solicitud = await SolicitudTramites.findByPk(
            row.solicitudTramiteId,
            {
              include: [
                Usuarios,
                Tramitador,
                Municipios,
                Operaciones,
                Tramite
              ],
              transaction: t
            }
          )

          if (solicitud?.usuario) {

            const ultimaTrazabilidad = await Trazabilidad.findOne({
              where: {
                solicitudTramiteId: solicitud.id
              },
              order: [['createdAt', 'DESC']],
              transaction: t
            })

            await crearNotificacion({
              solicitud,
              tipo: 'FINALIZADO',
              destinatario: solicitud.usuario,
              data: {
                nombre: solicitud.usuario.nombreUsuario,
                fecha: fechaColombia(),
                tramitador:
                  solicitud.tramitador?.nombreTramitador || 'N/A',
                municipio:
                  solicitud.municipios?.nombreMunicipio || 'N/A',
                operacion:
                  solicitud.operaciones?.nombreOperacion || 'N/A',
                tipo:
                  solicitud.tramite?.nombreTramite || 'N/A',
                programador:
                  solicitud.tramite?.responsable || 'N/A',
                resultado:
                  ultimaTrazabilidad?.observacionTrazabilidad ||
                  'Sin observaciones'
              }
            })
          }
        }

      } catch (error: any) {

        errores.push({
          fila,
          error: error.message
        })

        console.error(
          `❌ Error fila ${fila}:`,
          error.message
        )
      }
    }

    await t.commit()

    return {
      errores
    }

  } catch (error) {

    await t.rollback()
    throw error
  }
}