import { db } from '../config/db'
import SolicitudTramites from '../models/solicitudTramites'

export const procesarTramitador = async (data: any[], usuarioId: number) => {

  const t = await db.transaction()
  const errores: any[] = []

  try {

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const fila = i + 2

      try {

        const solicitud = await SolicitudTramites.findByPk(
          row.solicitudTramiteId,
          { transaction: t }
        )

        if (!solicitud) {
          throw new Error('Solicitud no existe')
        }

        solicitud.usuarioQueModifica = usuarioId
        await solicitud.update({
          tramitadorId: row.tramitadorId
        }, { transaction: t })

      } catch (error: any) {
        errores.push({ fila, error: error.message })
      }
    }

    await t.commit()
    return { errores }

  } catch (error) {
    await t.rollback()
    throw error
  }
}