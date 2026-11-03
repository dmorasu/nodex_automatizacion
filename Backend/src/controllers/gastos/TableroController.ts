import type { Request, Response } from 'express'
import { excelPagadoPorEstadoTramite, obtenerTablero } from '../../services/gastos/tablero'
import { generarReporteGastos } from '../../services/gastos/reportes'
import { excelPagadoPorTramitador, obtenerPagadoPorTramitador, type FiltrosPagadoTramitador } from '../../services/gastos/pagadoTramitador'
import { responderError } from './utilidades'

const textoOpcional = (valor: unknown) => (typeof valor === 'string' && valor.trim()) || null

const filtrosPagadoTramitador = (req: Request): FiltrosPagadoTramitador => ({
  bolsaId: req.query.bolsaId ? Number(req.query.bolsaId) : null,
  desde: textoOpcional(req.query.desde),
  hasta: textoOpcional(req.query.hasta),
  busqueda: textoOpcional(req.query.busqueda),
  estadoTramite: textoOpcional(req.query.estadoTramite),
  mostrar: (textoOpcional(req.query.mostrar) ?? 'todos') as FiltrosPagadoTramitador['mostrar']
})

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

  // GET /tablero/estado-tramite/exportar?bolsaId=&desde=&hasta=  → .xlsx del pagado por estado del trámite
  static exportarPorEstadoTramite = async (req: Request, res: Response) => {
    try {
      const { buffer } = await excelPagadoPorEstadoTramite({
        bolsaId: req.query.bolsaId ? Number(req.query.bolsaId) : null,
        desde: textoOpcional(req.query.desde),
        hasta: textoOpcional(req.query.hasta)
      })
      const fecha = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="pagado-por-estado-tramite-${fecha}.xlsx"`)
      res.send(Buffer.from(buffer as ArrayBuffer))
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /pagado-tramitador?bolsaId=&desde=&hasta=&busqueda=&estadoTramite=&mostrar=
  static getPagadoPorTramitador = async (req: Request, res: Response) => {
    try {
      res.json(await obtenerPagadoPorTramitador(filtrosPagadoTramitador(req)))
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /pagado-tramitador/exportar (mismos filtros) → .xlsx
  static exportarPagadoPorTramitador = async (req: Request, res: Response) => {
    try {
      const buffer = await excelPagadoPorTramitador(filtrosPagadoTramitador(req))
      const fecha = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="pagado-por-tramitador-${fecha}.xlsx"`)
      res.send(Buffer.from(buffer as ArrayBuffer))
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
