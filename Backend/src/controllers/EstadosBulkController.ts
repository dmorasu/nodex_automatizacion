import { Request, Response } from 'express'

import { filasDeLaPeticion } from '../utils/filasMasivas'
import { validarEstados } from '../utils/validacionesActualizaciones'
import { procesarEstados } from '../services/estadosActualizaciones'
import { generarPlantillaEstados } from '../utils/generarPlantillaEstados' // si usas genérico
// o si hiciste uno específico:
// import { generarPlantillaEstados } from '../utils/generarPlantillaEstados'

// ============================
// VALIDAR
// ============================
export const validarEstadosController = async (req: Request, res: Response) => {
  try {
    const filas = filasDeLaPeticion(req)
  if (typeof filas === 'string') {
    return res.status(400).json({ error: filas })
  }
  const data = filas
    const errores = await validarEstados(data)

    return res.json({
      totalProcesados: data.length,
      errores
    })
  } catch (error: any) {
    console.error(error)
    return res.status(500).json({
      error: 'Error validando archivo de estados'
    })
  }
}

// ============================
// PROCESAR
// ============================
export const procesarEstadosController = async (req: Request, res: Response) => {
  try {
    const filas = filasDeLaPeticion(req)
  if (typeof filas === 'string') {
    return res.status(400).json({ error: filas })
  }
  const data = filas

    // 1) Validar primero
    const errores = await validarEstados(data)

    if (errores.length > 0) {
      return res.status(400).json({
        message: 'Errores en el archivo',
        errores
      })
    }

    // 2) Procesar (incluye la regla estadoId = 6 → Programacion)
    const result = await procesarEstados(data)

    return res.json({
      message: 'Estados cargados correctamente',
      totalProcesados: data.length,
      errores: result.errores
    })
  } catch (error: any) {
    console.error(error)
    return res.status(500).json({
      error: 'Error procesando estados'
    })
  }
}

// ============================
// PLANTILLA
// ============================
export const descargarPlantillaEstados = async (req, res) => {
  try {

    const buffer = await generarPlantillaEstados()

    res.setHeader(
      'Content-Disposition',
      'attachment; filename=plantilla_estados.xlsx'
    )

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )

    return res.send(buffer)

  } catch (error) {
    console.error(error)
    return res.status(500).json({
      error: 'Error generando plantilla'
    })
  }
}