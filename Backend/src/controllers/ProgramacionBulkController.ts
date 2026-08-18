// controllers/programacionMasiva.controller.ts

import { Request, Response } from 'express'

import { parseExcel } from '../utils/excelParser'
import { validarProgramacion } from '../utils/validacionesActualizaciones'
import { procesarProgramacion } from '../services/programacionActualizaciones'
import { generarPlantillaProgramacion } from '../utils/generarPlantillaProgramacion'

import SolicitudTramites from '../models/solicitudTramites'
import Programacion from '../models/programacion'
import Tramite from '../models/tramite'
import Operaciones from '../models/operaciones'
import Tramitador from '../models/tramitador'
import Municipios from '../models/municipios'
import Usuarios from '../models/usuarios'
import { crearNotificacion } from '../services/notificacionesServices'
import { formatearFecha} from "../utils/fechaColombia";

// 🔥 tipo del Excel (ajústalo si tienes más columnas)
type ProgramacionRow = {
  solicitudTramiteId: number
  fechaProbableEntrega?: string | null
  valorTramite?: number | null
  valorViaticos?: number | null
  conceptoHonorarios?: string | null
  conceptoViaticos?: string | null
}

// =========================
// VALIDAR
// =========================
export const validarProgramacionController = async (req: Request, res: Response) => {

  if (!req.file) {
    return res.status(400).json({ error: 'Archivo requerido' })
  }

  const data = parseExcel(req.file.buffer) as ProgramacionRow[]

  const errores = await validarProgramacion(data)

  return res.json({
    totalProcesados: data.length,
    errores
  })
}

// =========================
// PROCESAR
// =========================
export const procesarProgramacionController = async (req: Request, res: Response) => {

  if (!req.file) {
    return res.status(400).json({ error: 'Archivo requerido' })
  }

  const data = parseExcel(req.file.buffer) as ProgramacionRow[]

  const errores = await validarProgramacion(data)

  if (errores.length > 0) {
    return res.status(400).json({ errores })
  }

  const result = await procesarProgramacion(data)

  // =========================
  // 🔔 NOTIFICACIONES MASIVAS (EMAIL)
  // =========================
  try {

    // 🔥 evitar duplicados (por solicitud)
    const unique = new Map<number, ProgramacionRow>()

    data.forEach(row => {
      if (row.solicitudTramiteId) {
        unique.set(row.solicitudTramiteId, row)
      }
    })

    const tareas = Array.from(unique.values()).map(async (row) => {
      try {

       const solicitud = await SolicitudTramites.findByPk(
  row.solicitudTramiteId,
  {
    include: [
      Usuarios,
      Programacion,
      Tramite,
      Tramitador,
      Municipios,
      Operaciones
    ]
  }
)

if (!solicitud?.usuario?.correoUsuario) {
  return
}

const programacion = solicitud.programacion




if (!programacion) {
  console.log(
    `⚠️ Solicitud ${row.solicitudTramiteId} sin programación`
  )
  return
}

await crearNotificacion({
  solicitud,
  tipo: 'PROGRAMACION',
  destinatario: solicitud.usuario,
  data: {
    nombre: solicitud.usuario?.nombreUsuario,
    tipo: solicitud.tramite?.nombreTramite,
    fecha:  formatearFecha(programacion.fechaProbableEntrega),
    tramitador: solicitud.tramitador?.nombreTramitador,
    municipio: solicitud.municipios?.nombreMunicipio,
    operacion: solicitud.operaciones?.nombreOperacion,
    programador: solicitud.tramite?.responsable
  }
})
console.log(
  '📋 Programación BD:',
  data
)

      } catch (error) {
        console.error('Error notificando programación', row, error)
      }
    })

    await Promise.all(tareas)

  } catch (error) {
    console.error('Error en notificaciones programación masiva', error)
  }

  return res.json({
    message: 'Programación cargada correctamente',
    totalProcesados: data.length,
    errores: result.errores
  })
}

// =========================
// PLANTILLA
// =========================
export const descargarPlantillaProgramacion = async (req: Request, res: Response) => {

  const buffer = await generarPlantillaProgramacion()

  res.setHeader(
    'Content-Disposition',
    'attachment; filename=plantilla_programacion.xlsx'
  )

  res.send(buffer)
}