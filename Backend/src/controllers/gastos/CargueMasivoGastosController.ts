import type { Request, Response } from 'express'
import multer from 'multer'
import { cargarGastos, generarPlantilla, validarCargue } from '../../services/gastos/cargueMasivoGastos'
import { ErrorGastos } from '../../services/gastos/errores'
import { notificarGastosCreados } from '../../services/gastos/notificacionesGastos'
import { soloTramitesPropios } from '../../middleware/auth'
import { responderError } from './utilidades'

// Un solo archivo Excel (.xlsx) de hasta 5 MB en el campo "archivo"
export const recibirExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(null, /\.xlsx$/i.test(file.originalname))
}).single('archivo')

// Gestión de activos solo trabaja con sus propios trámites
const propiosDe = (req: Request) => (soloTramitesPropios(req) ? req.usuario.id : null)

const archivo = (req: Request) => {
  if (!req.file) throw new ErrorGastos('Adjunte el archivo Excel (.xlsx) generado con la plantilla')
  return req.file.buffer
}

export class CargueMasivoGastosController {

  // GET /cargue-masivo/plantilla?tramites=1,2,3  → plantilla (prellenada si hay trámites)
  static plantilla = async (req: Request, res: Response) => {
    try {
      const tramiteIds = String(req.query.tramites ?? '')
        .split(',')
        .map(Number)
        .filter(id => Number.isInteger(id) && id > 0)
        .slice(0, 500)

      const buffer = await generarPlantilla(tramiteIds, propiosDe(req))

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', 'attachment; filename="plantilla_gastos.xlsx"')
      res.send(Buffer.from(buffer as ArrayBuffer))
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /cargue-masivo/validar  (archivo) → { total, errores: [{ fila, error }] }
  static validar = async (req: Request, res: Response) => {
    try {
      res.json(await validarCargue(archivo(req), propiosDe(req)))
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /cargue-masivo/cargar  (archivo) → todo o nada
  static cargar = async (req: Request, res: Response) => {
    try {
      const resultado = await cargarGastos(archivo(req), req.usuario.id, propiosDe(req))

      if (!resultado.ok) {
        return res.status(400).json({
          error: `El archivo tiene ${resultado.errores.length} error(es). No se cargó ningún gasto.`,
          total: resultado.total,
          errores: resultado.errores
        })
      }

      // Un solo correo a Tesorería con todos los gastos cargados
      void notificarGastosCreados(resultado.ids)

      res.status(201).json({ total: resultado.total, codigos: resultado.codigos })
    } catch (error) {
      responderError(res, error)
    }
  }
}
