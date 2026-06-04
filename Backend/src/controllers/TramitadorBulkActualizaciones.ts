import { Request, Response } from 'express'

import { parseExcel } from '../utils/excelParser'
import { validarTramitador } from '../utils/validacionesActualizaciones'
import { procesarTramitador } from '../services/tramitadorActualizaciones'
import { generarPlantillaTramitador } from '../utils/generarPlantillaTramitador'

import Tramitador from '../models/tramitador'
import SolicitudTramites from '../models/solicitudTramites'
import { crearNotificacion } from '../services/notificacionesServices'

// 🔥 tipo del Excel
type TramitadorRow = {
  solicitudTramiteId: number
  tramitadorId: number
}

// =========================
// VALIDAR
// =========================
export const validarTramitadorController = async (req: Request, res: Response) => {

  if (!req.file) {
    return res.status(400).json({ error: 'Archivo requerido' })
  }

  const data = parseExcel(req.file.buffer) as TramitadorRow[]

  const errores = await validarTramitador(data)

  return res.json({
    totalProcesados: data.length,
    errores
  })
}

// =========================
// PROCESAR
// =========================
export const procesarTramitadorController = async (req: Request, res: Response) => {

  if (!req.file) {
    return res.status(400).json({ error: 'Archivo requerido' })
  }

  const data = parseExcel(req.file.buffer) as TramitadorRow[]

  const errores = await validarTramitador(data)

  if (errores.length > 0) {
    return res.status(400).json({ errores })
  }

  const result = await procesarTramitador(data)

  // =========================
  // 🔔 NOTIFICACIONES MASIVAS
  // =========================
  try {

    // 🔥 evitar duplicados
    const unique = new Map<string, TramitadorRow>()

    data.forEach(row => {
      const key = `${row.solicitudTramiteId}-${row.tramitadorId}`
      unique.set(key, row)
    })

    const tareas = Array.from(unique.values()).map(async (row) => {
      try {

        const solicitud = await SolicitudTramites.findByPk(row.solicitudTramiteId)
        const tramitador = await Tramitador.findByPk(row.tramitadorId)

        if (!solicitud || !tramitador?.numeroTramitador) return

        await crearNotificacion({
          solicitud,
          tipo: 'ASIGNADO',
          destinatario: tramitador
        })

      } catch (error) {
        console.error('Error notificando fila', row, error)
      }
    })

    await Promise.all(tareas)

  } catch (error) {
    console.error('Error en notificaciones masivas', error)
  }

  return res.json({
    message: 'Tramitador asignado correctamente',
    totalProcesados: data.length,
    errores: result.errores
  })
}

// =========================
// PLANTILLA
// =========================
export const descargarPlantillaTramitador = async (req: Request, res: Response) => {

  const buffer = await generarPlantillaTramitador()

  res.setHeader(
    'Content-Disposition',
    'attachment; filename=plantilla_tramitador.xlsx'
  )

  res.send(buffer)
}