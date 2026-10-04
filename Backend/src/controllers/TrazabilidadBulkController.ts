import { Request, Response } from 'express'

import { filasDeLaPeticion } from '../utils/filasMasivas'
import { validarTrazabilidad } from '../utils/validacionesActualizaciones'
import { procesarTrazabilidad } from '../services/trazabilidadActualizaciones'
import { generarPlantillaTrazabilidad } from '../utils/generarPlantillaTrazabilidad'

import SolicitudTramites from '../models/solicitudTramites'
import Usuarios from '../models/usuarios'
import { crearNotificacion } from '../services/notificacionesServices'

// 🔥 tipo del Excel
type TrazabilidadRow = {
  solicitudTramiteId: number
  observacionTrazabilidad: string
  nombreUsuario?: string | null
}

// =========================
// VALIDAR
// =========================
export const validarTrazabilidadController = async (req: Request, res: Response) => {

  const filas = filasDeLaPeticion(req)
  if (typeof filas === 'string') {
    return res.status(400).json({ error: filas })
  }
  const data = filas as TrazabilidadRow[]
  // Sin nombre de usuario (gestión en pantalla) queda el de quien hace el cargue
  data.forEach(row => { if (!row.nombreUsuario) row.nombreUsuario = req.usuario.nombreUsuario })

  const errores = await validarTrazabilidad(data)

  return res.json({
    totalProcesados: data.length,
    errores
  })
}

// =========================
// PROCESAR
// =========================
export const procesarTrazabilidadController = async (req: Request, res: Response) => {

  const filas = filasDeLaPeticion(req)
  if (typeof filas === 'string') {
    return res.status(400).json({ error: filas })
  }
  const data = filas as TrazabilidadRow[]
  // Sin nombre de usuario (gestión en pantalla) queda el de quien hace el cargue
  data.forEach(row => { if (!row.nombreUsuario) row.nombreUsuario = req.usuario.nombreUsuario })

  const errores = await validarTrazabilidad(data)

  if (errores.length > 0) {
    return res.status(400).json({ errores })
  }

  const result = await procesarTrazabilidad(data)

  // =========================
  // 🔔 NOTIFICACIONES MASIVAS (EMAIL)
  // =========================
  try {

    // 🔥 evitar duplicados
    const unique = new Map<string, TrazabilidadRow>()

    data.forEach(row => {
      const key = `${row.solicitudTramiteId}-${row.observacionTrazabilidad}`
      unique.set(key, row)
    })

    const tareas = Array.from(unique.values()).map(async (row) => {
      try {

        const solicitud = await SolicitudTramites.findByPk(
          row.solicitudTramiteId,
          { include: [Usuarios] }
        )

        if (!solicitud?.usuario?.correoUsuario) return

       /*  await crearNotificacion({
          solicitud,
          tipo: 'TRAZABILIDAD',
          destinatario: solicitud.usuario,
          data: {
            observacion: row.observacionTrazabilidad // 🔥 clave
          }
        }) */

      } catch (error) {
        console.error('Error notificando trazabilidad', row, error)
      }
    })

    await Promise.all(tareas)

  } catch (error) {
    console.error('Error en notificaciones trazabilidad masiva', error)
  }

  return res.json({
    message: 'Trazabilidad cargada correctamente',
    totalProcesados: data.length,
    errores: result.errores
  })
}

// =========================
// PLANTILLA
// =========================
export const descargarPlantillaTrazabilidad = async (req: Request, res: Response) => {

  const buffer = await generarPlantillaTrazabilidad()

  res.setHeader(
    'Content-Disposition',
    'attachment; filename=plantilla_trazabilidad.xlsx'
  )

  res.send(buffer)
}