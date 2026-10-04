import type { Request, Response } from 'express'
import {
  ErrorAnalistas,
  asignarAnalista,
  asignarAnalistaMunicipios,
  listarAnalistas,
  listarMunicipios,
  reasignarTramitesAbiertos,
  resumenPorAnalista
} from '../services/analistasTramites'

const responder = (res: Response, error: unknown) => {
  if (error instanceof ErrorAnalistas) return res.status(error.status).json({ error: error.message })
  console.error('ANALISTAS TRÁMITES:', error)
  return res.status(500).json({ error: 'No se pudo completar la operación' })
}

// null o '' = sin analista
const idONulo = (valor: unknown) => (valor === null || valor === '' || valor === undefined ? null : Number(valor))

const esIdValido = (valor: number | null) => valor === null || (Number.isInteger(valor) && valor > 0)

export class AnalistasTramitesController {

  static listar = async (_req: Request, res: Response) => {
    try {
      res.json(await listarAnalistas())
    } catch (error) {
      responder(res, error)
    }
  }

  static resumen = async (_req: Request, res: Response) => {
    try {
      res.json(await resumenPorAnalista())
    } catch (error) {
      responder(res, error)
    }
  }

  static asignar = async (req: Request, res: Response) => {
    try {
      const analistaId = idONulo(req.body.analistaId)
      if (!esIdValido(analistaId)) return res.status(400).json({ error: 'Analista no válido' })

      await asignarAnalista(Number(req.params.solicitudTramitesId), analistaId)
      res.json({ mensaje: analistaId ? 'Analista asignado' : 'Se quitó el analista del trámite' })
    } catch (error) {
      responder(res, error)
    }
  }

  static reasignar = async (req: Request, res: Response) => {
    try {
      const desdeId = idONulo(req.body.desdeId)
      const haciaId = idONulo(req.body.haciaId)
      if (!esIdValido(desdeId) || !esIdValido(haciaId)) return res.status(400).json({ error: 'Analista no válido' })

      res.json(await reasignarTramitesAbiertos(desdeId, haciaId))
    } catch (error) {
      responder(res, error)
    }
  }

  static municipios = async (req: Request, res: Response) => {
    try {
      const filtro = String(req.query.analistaId ?? '')
      res.json(await listarMunicipios({
        busqueda: String(req.query.busqueda ?? '').trim().slice(0, 100) || undefined,
        analistaId: filtro === 'sin' ? 'sin' : Number(filtro) > 0 ? Number(filtro) : undefined,
        pagina: Math.max(1, Number(req.query.pagina) || 1)
      }))
    } catch (error) {
      responder(res, error)
    }
  }

  static asignarMunicipios = async (req: Request, res: Response) => {
    try {
      const analistaId = idONulo(req.body.analistaId)
      const municipioIds: unknown = req.body.municipioIds
      if (!esIdValido(analistaId)) return res.status(400).json({ error: 'Analista no válido' })
      if (!Array.isArray(municipioIds) || municipioIds.length === 0 || municipioIds.length > 500
        || !municipioIds.every(id => Number.isInteger(id) && id > 0)) {
        return res.status(400).json({ error: 'Seleccione entre 1 y 500 municipios' })
      }

      res.json(await asignarAnalistaMunicipios(municipioIds as number[], analistaId))
    } catch (error) {
      responder(res, error)
    }
  }
}
