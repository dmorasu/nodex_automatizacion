import type { Request } from 'express'
import { parseExcel } from './excelParser'

// Máximo de filas por envío desde la gestión masiva en pantalla
const MAXIMO_FILAS = 500

// Filas de una actualización masiva: del Excel (hoja DATA) o, desde la gestión en pantalla,
// del cuerpo JSON { filas: [...] }. Las dos llegan con las mismas columnas y pasan por la
// misma validación y el mismo proceso.
// Devuelve las filas, o un texto con el motivo si no se pueden leer (no lanza errores:
// varios controladores no tienen try/catch).
export const filasDeLaPeticion = (req: Request): any[] | string => {
  if (req.file) {
    try {
      return parseExcel(req.file.buffer)
    } catch (error) {
      return (error as Error).message
    }
  }

  const filas = req.body?.filas
  if (!Array.isArray(filas) || filas.length === 0) return 'Adjunte el archivo o envíe las filas a procesar'
  if (filas.length > MAXIMO_FILAS) return `Máximo ${MAXIMO_FILAS} trámites por envío`
  return filas
}
