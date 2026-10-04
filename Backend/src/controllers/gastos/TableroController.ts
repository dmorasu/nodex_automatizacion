import type { Request, Response } from 'express'
import { obtenerTablero } from '../../services/gastos/tablero'
import { generarReporteGastos } from '../../services/gastos/reportes'
import { obtenerReintegrosPorTramitador } from '../../services/gastos/reintegrosTramitador'
import { responderError } from './utilidades'

const textoOpcional = (valor: unknown) => (typeof valor === 'string' && valor.trim()) || null

export class TableroController {

  // GET /tablero?bolsaId=&desde=&hasta=
  static getTablero = async (req: Request, res: Response) => {
    try {
      res.json(await obtenerTablero({
        bolsaId: req.query.bolsaId ? Number(req.query.bolsaId) : null,
        desde: textoOpcional(req.query.desde),
        hasta: textoOpcional(req.query.hasta)
      }))
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /reintegros-tramitador?bolsaId=&desde=&hasta=&busqueda=&estado=pendientes|todos&diasMinimos=
  static getReintegrosPorTramitador = async (req: Request, res: Response) => {
    try {
      res.json(await obtenerReintegrosPorTramitador({
        bolsaId: req.query.bolsaId ? Number(req.query.bolsaId) : null,
        desde: textoOpcional(req.query.desde),
        hasta: textoOpcional(req.query.hasta),
        busqueda: textoOpcional(req.query.busqueda),
        soloPendientes: req.query.estado !== 'todos',
        diasMinimos: req.query.diasMinimos ? Number(req.query.diasMinimos) : null
      }))
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /reportes/gastos?estado=&bolsaId=&desde=&hasta=  → archivo .xlsx
  static exportarGastos = async (req: Request, res: Response) => {
    try {
      const { buffer, filas } = await generarReporteGastos({
        estado: textoOpcional(req.query.estado),
        bolsaId: req.query.bolsaId ? Number(req.query.bolsaId) : null,
        desde: textoOpcional(req.query.desde),
        hasta: textoOpcional(req.query.hasta)
      })

      const fecha = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="gastos-${fecha}.xlsx"`)
      res.setHeader('X-Total-Filas', String(filas))
      res.send(Buffer.from(buffer as ArrayBuffer))
    } catch (error) {
      responderError(res, error)
    }
  }
}
