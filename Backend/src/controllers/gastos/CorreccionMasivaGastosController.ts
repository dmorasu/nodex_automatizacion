import type { Request, Response } from 'express'
import { Op } from 'sequelize'
import { aplicarCorreccion, generarPlantillaCorreccion, validarCorreccion } from '../../services/gastos/correccionMasivaGastos'
import { ErrorGastos } from '../../services/gastos/errores'
import { condicionesListado, ORDENES } from './SolicitudesGastoController'
import { responderError } from './utilidades'

const archivo = (req: Request) => {
  if (!req.file) throw new ErrorGastos('Adjunte el Excel de corrección (.xlsx)')
  return req.file.buffer
}

// Corrección masiva de gastos (solo Administrador de Gastos; ver el servicio)
export class CorreccionMasivaGastosController {

  // GET /correccion-masiva/plantilla?<filtros del listado>  → Excel con esos gastos (máximo 500)
  static plantilla = async (req: Request, res: Response) => {
    try {
      const buffer = await generarPlantillaCorreccion(
        { [Op.and]: await condicionesListado(req) },
        ORDENES[String(req.query.orden)] ?? ORDENES.recientes
      )

      const fecha = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="correccion_gastos_${fecha}.xlsx"`)
      res.send(Buffer.from(buffer as ArrayBuffer))
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /correccion-masiva/validar  (archivo) → { total, sinCambios, errores, cambios }
  static validar = async (req: Request, res: Response) => {
    try {
      res.json(await validarCorreccion(archivo(req)))
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /correccion-masiva/aplicar  (archivo, motivo) → todo o nada
  static aplicar = async (req: Request, res: Response) => {
    try {
      const motivo = String(req.body?.motivo ?? '').trim()
      if (!motivo) throw new ErrorGastos('Indique el motivo de la corrección')
      if (motivo.length > 500) throw new ErrorGastos('El motivo no puede superar 500 caracteres')

      const resultado = await aplicarCorreccion(archivo(req), motivo, req.usuario.id)

      if (!resultado.ok) {
        return res.status(400).json({
          error: `El archivo tiene ${resultado.errores.length} error(es). No se aplicó ninguna corrección.`,
          total: resultado.total,
          errores: resultado.errores
        })
      }

      res.json({ total: resultado.total, sinCambios: resultado.sinCambios, cambios: resultado.cambios })
    } catch (error) {
      responderError(res, error)
    }
  }
}
