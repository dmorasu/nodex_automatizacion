import { db } from '../config/db'
import Logistica from '../models/logistica'
import { excelDateToString } from '../utils/excelDate'

export const procesarLogistica = async (data: any[]) => {

  const t = await db.transaction()
  const errores: any[] = []

  try {

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const fila = i + 2

      try {

        const existe = await Logistica.findOne({
          where: { solicitudTramiteId: row.solicitudTramiteId },
          transaction: t
        })

console.log("Solicitud:", row.solicitudTramiteId);
console.log("Existe:", !!existe);

        // 🔥 CONVERSIÓN DE FECHAS
        const fechaProg = excelDateToString(row.fechaProgramacionLogistica)
const fechaEntrega = excelDateToString(row.fechaEntregaTransportadora)

        if (existe) {
          console.log("ACTUALIZANDO", existe.id);
          await existe.update({
            numeroGuia: row.numeroGuia || null,
            destinatario: row.destinatario || null,
            valorEnvio: row.valorEnvio || null,
            transportadoraId: row.transportadoraId || null,
            fechaProgramacionLogistica: fechaProg,
            fechaEntregaTransportadora: fechaEntrega
          }, { transaction: t })

        } else {
       console.log("CREANDO", {
  solicitudTramiteId: row.solicitudTramiteId,
  numeroGuia: row.numeroGuia
});
          await Logistica.create({
            solicitudTramiteId: row.solicitudTramiteId,
            numeroGuia: row.numeroGuia || null,
            destinatario: row.destinatario || null,
            valorEnvio: row.valorEnvio || null,
            transportadoraId: row.transportadoraId || null,
            fechaProgramacionLogistica: fechaProg,
            fechaEntregaTransportadora: fechaEntrega
          }, { transaction: t })
        }

      } catch (error: any) {
        errores.push({ fila, error: error.message })
        console.error("ERROR FILA", fila, error);
  errores.push({
    fila,
    error: error.message
  });
      }
    }

    await t.commit()
    return { errores }

  } catch (error) {
    await t.rollback()
    throw error
  }
}