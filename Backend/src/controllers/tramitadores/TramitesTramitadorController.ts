import type { Request, Response } from 'express'
import {
  comentarComoTramitador,
  comentarComoUsuario,
  documentoDelTramitador,
  subirDocumentosTramite,
  listarReportes,
  listarTramitesDelTramitador,
  obtenerTramiteDelTramitador,
  reportarRealizado,
  revisarReporte,
  seguimientoParaUsuario,
  type FiltroTramites,
  type TipoDocumentoTramite
} from '../../services/tramitadores/tramitesTramitador'
import { ESTADOS_REPORTE } from '../../models/tramitadores/reporteRealizado'
import { soloTramitesPropios } from '../../middleware/auth'
import { responderError } from '../gastos/utilidades'

const textoOpcional = (valor: unknown) => (typeof valor === 'string' && valor.trim()) || null

// ── App Nodex Tramitadores: siempre sobre los trámites del tramitador en sesión ──
export class TramitesTramitadorController {

  // GET /tramites?filtro=activos|cerrados|todos&busqueda=&pagina=
  static listar = async (req: Request, res: Response) => {
    try {
      res.json(await listarTramitesDelTramitador(req.sesionTramitador!.tramitadorId, {
        filtro: (textoOpcional(req.query.filtro) ?? 'activos') as FiltroTramites,
        busqueda: textoOpcional(req.query.busqueda),
        pagina: Number(req.query.pagina) || 1
      }))
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /tramites/:id
  static detalle = async (req: Request, res: Response) => {
    try {
      res.json(await obtenerTramiteDelTramitador(req.sesionTramitador!.tramitadorId, Number(req.params.id)))
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /tramites/:id/comentarios  { comentario }
  static comentar = async (req: Request, res: Response) => {
    try {
      await comentarComoTramitador(req.sesionTramitador!.tramitadorId, Number(req.params.id), req.body.comentario)
      res.status(201).json('Comentario agregado')
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /tramites/:id/documentos  (multipart: archivos[], tipoDocumento = SOPORTE | FACTURA | OTRO)
  static subirDocumentos = async (req: Request, res: Response) => {
    try {
      const { cantidad, gasto } = await subirDocumentosTramite(
        req.sesionTramitador!.tramitadorId,
        Number(req.params.id),
        req.body.tipoDocumento as TipoDocumentoTramite,
        (req.files ?? []) as Express.Multer.File[],
        req.body.solicitudGastoId ? Number(req.body.solicitudGastoId) : null
      )
      res.status(201).json(gasto
        ? `${cantidad} documento(s) cargado(s) al trámite y enviado(s) a Legalización con el gasto ${gasto}`
        : `${cantidad} documento(s) cargado(s) al trámite`)
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /tramites/:id/documentos/:documentoId/ver
  static verDocumento = async (req: Request, res: Response) => {
    try {
      const { documento, contenido } = await documentoDelTramitador(
        req.sesionTramitador!.tramitadorId, Number(req.params.id), Number(req.params.documentoId)
      )
      res.setHeader('Content-Type', documento.tipoArchivo)
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(documento.nombreOriginal)}"`)
      res.setHeader('Content-Length', contenido.length)
      res.send(contenido)
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /tramites/:id/realizado  { observacion }
  static reportarRealizado = async (req: Request, res: Response) => {
    try {
      await reportarRealizado(req.sesionTramitador!.tramitadorId, Number(req.params.id), req.body.observacion)
      res.status(201).json('Trámite reportado como realizado. Queda pendiente de revisión')
    } catch (error) {
      responderError(res, error)
    }
  }
}

// ── Nodex Trámites: seguimiento de lo que reportan los tramitadores ──
// Gestión de activos sin Torre de control solo ve los trámites que creó
const limiteDeUsuario = (req: Request) => (soloTramitesPropios(req) ? req.usuario.id : null)

export class SeguimientoTramitadorController {

  // GET /tramites/:id → comentarios y reportes del trámite
  static seguimiento = async (req: Request, res: Response) => {
    try {
      res.json(await seguimientoParaUsuario(Number(req.params.id), limiteDeUsuario(req)))
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /tramites/:id/comentarios  { comentario } → respuesta al tramitador
  static comentar = async (req: Request, res: Response) => {
    try {
      await comentarComoUsuario(req.usuario.id, Number(req.params.id), req.body.comentario, limiteDeUsuario(req))
      res.status(201).json('Comentario agregado')
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /reportes-realizado?estado=PENDIENTE|REVISADO
  static reportes = async (req: Request, res: Response) => {
    try {
      const estado = req.query.estado === ESTADOS_REPORTE.REVISADO ? ESTADOS_REPORTE.REVISADO : ESTADOS_REPORTE.PENDIENTE
      res.json(await listarReportes(estado, limiteDeUsuario(req)))
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /reportes-realizado/:id/revisar  { nota? }
  static revisar = async (req: Request, res: Response) => {
    try {
      await revisarReporte(Number(req.params.id), req.usuario.id, textoOpcional(req.body.nota), limiteDeUsuario(req))
      res.json('Reporte marcado como revisado')
    } catch (error) {
      responderError(res, error)
    }
  }
}
