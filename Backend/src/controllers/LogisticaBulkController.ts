import { Request, Response } from 'express'

import { filasDeLaPeticion } from '../utils/filasMasivas'
import { validarLogistica } from '../utils/validacionesActualizaciones'
import { procesarLogistica } from '../services/logisticaActualizaciones'
import { generarPlantillaLogistica } from '../utils/generarPlantillaLogistica'

// ============================
// VALIDAR EXCEL
// ============================
export const validarLogisticaController = async (req: Request, res: Response) => {
  try {

    const filas = filasDeLaPeticion(req)
  if (typeof filas === 'string') {
    return res.status(400).json({ error: filas })
  }
  const data = filas
    const errores = await validarLogistica(data)

    return res.json({
      totalProcesados: data.length,
      errores
    })

  } catch (error: any) {
    console.error(error)
    return res.status(500).json({
      error: 'Error validando archivo de logística'
    })
  }
}

// ============================
// PROCESAR EXCEL
// ============================
export const procesarLogisticaController = async (req: Request, res: Response) => {
  try {

    const filas = filasDeLaPeticion(req)
  if (typeof filas === 'string') {
    return res.status(400).json({ error: filas })
  }
  const data = filas

    const errores = await validarLogistica(data)

    if (errores.length > 0) {
      return res.status(400).json({
        message: 'Errores en el archivo',
        errores
      })
    }

    const result = await procesarLogistica(data)

    return res.json({
      message: 'Logística cargada correctamente',
      totalProcesados: data.length,
      errores: result.errores
    })

  } catch (error: any) {
    console.error(error)
    return res.status(500).json({
      error: 'Error procesando archivo de logística'
    })
  }
}

// ============================
// DESCARGAR PLANTILLA
// ============================
export const descargarPlantillaLogistica = async (req, res) => {
  try {

    const buffer = await generarPlantillaLogistica()

    res.setHeader(
      'Content-Disposition',
      'attachment; filename=plantilla_logistica.xlsx'
    )

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )

    return res.send(buffer)

  } catch (error) {
    console.error(error)
    return res.status(500).json({
      error: 'Error generando plantilla de logística'
    })
  }
}