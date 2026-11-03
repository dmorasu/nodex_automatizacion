import { db } from '../config/db'
import Programacion from '../models/programacion'
import { excelDateToString } from '../utils/excelDate'
import { verificarCitaDelTramite } from './mensajeria/agenda'

export const procesarProgramacion = async (data: any[]) => {

  const t = await db.transaction()
  const errores: any[] = []

  try {

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const fila = i + 2

      try {

        const existe = await Programacion.findOne({
          where: { solicitudTramiteId: row.solicitudTramiteId },
          transaction: t
        })

       
        const fechaEntrega = excelDateToString(row.fechaProbableEntrega)
        // Si tiene cita, el horario debe estar libre en la agenda del mensajero el nuevo día
        await verificarCitaDelTramite(Number(row.solicitudTramiteId), { fecha: fechaEntrega }, t)
       

        if (existe) {

          await existe.update({
          
            fechaProbableEntrega: fechaEntrega,
            
            valorTramite: row.valorTramite || null,
            valorViaticos: row.valorViaticos || null,
            conceptoHonorarios: row.conceptoHonorarios || null,
            conceptoViaticos: row.conceptoViaticos || null
          }, { transaction: t })

        } else {

          await Programacion.create({
            solicitudTramiteId: row.solicitudTramiteId,
          
            fechaProbableEntrega: fechaEntrega,
            
            valorTramite: row.valorTramite || null,
            valorViaticos: row.valorViaticos || null,
            conceptoHonorarios: row.conceptoHonorarios || null,
            conceptoViaticos: row.conceptoViaticos || null
          }, { transaction: t })
        }

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