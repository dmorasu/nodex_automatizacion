import type { Request, Response } from 'express'
import { obtenerArchivo } from '../../services/azureFileStorage'
import {
  aprobarSoporte,
  archivoEsReembolsable,
  soporteEsReembolsable,
  listarGastosDelTramitador,
  listarSoportes,
  obtenerArchivoSoporte,
  obtenerGastoDelTramitador,
  rechazarSoporte,
  subirSoporte
} from '../../services/tramitadores/soportesTramitador'
import { ESTADOS_SOPORTE, TIPOS_SOPORTE } from '../../models/tramitadores/soporteTramitador'
import { esAdmin, puedeGestionarFactura, responderError } from '../gastos/utilidades'
import { ErrorGastos } from '../../services/gastos/errores'
import { notificarOperacionTramitador } from '../../services/tramitadores/correosTramitador'
import { NOMBRES_TIPO_SOPORTE } from '../../services/tramitadores/nombresDocumento'

const textoOpcional = (valor: unknown) => (typeof valor === 'string' && valor.trim()) || null

// Envía el archivo de Azure para verlo en el navegador
const enviarArchivo = async (res: Response, archivoId: number, tramitadorId: number | null) => {
  const archivo = await obtenerArchivoSoporte(archivoId, tramitadorId)
  const contenido = await obtenerArchivo(archivo.rutaDirectorio, archivo.nombreArchivo)

  res.setHeader('Content-Type', archivo.tipoArchivo)
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(archivo.nombreOriginal)}"`)
  res.setHeader('Content-Length', contenido.length)
  res.send(contenido)
}

// ── App Nodex Tramitadores: gastos del tramitador en sesión y sus soportes ──
export class GastosTramitadorController {

  // GET /gastos?pagina=  → solo los gastos con reintegro pendiente
  static listar = async (req: Request, res: Response) => {
    try {
      res.json(await listarGastosDelTramitador(req.sesionTramitador!.tramitadorId, {
        pagina: Number(req.query.pagina) || 1
      }))
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /gastos/:id
  static detalle = async (req: Request, res: Response) => {
    try {
      res.json(await obtenerGastoDelTramitador(req.sesionTramitador!.tramitadorId, Number(req.params.id)))
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /gastos/:id/soportes  (multipart: archivos[], tipo, reintegroId?, observacion?)
  static subirSoporte = async (req: Request, res: Response) => {
    try {
      const tramitadorId = req.sesionTramitador!.tramitadorId
      const tipo = req.body.tipo as typeof TIPOS_SOPORTE[keyof typeof TIPOS_SOPORTE]
      const observacion = textoOpcional(req.body.observacion)
      const archivos = (req.files ?? []) as Express.Multer.File[]
      const soporte = await subirSoporte(
        tramitadorId,
        Number(req.params.id),
        { tipo, reintegroId: req.body.reintegroId ? Number(req.body.reintegroId) : null, observacion },
        archivos
      )
      res.status(201).json('Soporte enviado. Queda pendiente de revisión por Legalización')
      // Correo al analista del trámite del gasto (o a la torre de control si no tiene)
      void notificarOperacionTramitador(soporte.solicitudTramiteId, tramitadorId, {
        tipo: 'SOPORTE_GASTO',
        tipoSoporte: NOMBRES_TIPO_SOPORTE[tipo] ?? tipo,
        gasto: soporte.codigoGasto,
        archivos: archivos.map(a => a.originalname),
        observacion
      })
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /soportes/archivos/:id/ver  (solo sus propios archivos)
  static verArchivo = async (req: Request, res: Response) => {
    try {
      await enviarArchivo(res, Number(req.params.id), req.sesionTramitador!.tramitadorId)
    } catch (error) {
      responderError(res, error)
    }
  }
}

// ── Nodex Gastos: revisión de los soportes ──
// Legalización revisa los de gastos reembolsables; Contabilidad los de no reembolsables.
const ROLES_REVISION = { LEGALIZACION: 'LEGALIZACION', CONTABILIDAD: 'CONTABILIDAD' }

// Qué soportes le corresponden a quien consulta: true = reembolsables, false = no reembolsables, null = todos.
// Con los dos roles (o administrador) se puede elegir con ?reembolsable=si|no
const reembolsablesQueRevisa = (req: Request): boolean | null => {
  const roles = req.roles ?? []
  const legalizacion = esAdmin(req) || roles.includes(ROLES_REVISION.LEGALIZACION)
  const contabilidad = esAdmin(req) || roles.includes(ROLES_REVISION.CONTABILIDAD)
  if (legalizacion && contabilidad) {
    return req.query.reembolsable === 'si' ? true : req.query.reembolsable === 'no' ? false : null
  }
  return legalizacion
}

const verificarQueLeCorresponde = (req: Request, reembolsable: boolean) => {
  if (!puedeGestionarFactura(req, reembolsable)) {
    throw new ErrorGastos(reembolsable
      ? 'Los soportes de gastos reembolsables los revisa Legalización'
      : 'Los soportes de gastos no reembolsables los revisa Contabilidad', 403)
  }
}

export class RevisionSoportesController {

  // GET /soportes-tramitador?estado=PENDIENTE|APROBADO|RECHAZADO&reembolsable=si|no
  static listar = async (req: Request, res: Response) => {
    try {
      const estados: string[] = Object.values(ESTADOS_SOPORTE)
      const estado = estados.includes(String(req.query.estado)) ? String(req.query.estado) : ESTADOS_SOPORTE.PENDIENTE
      res.json(await listarSoportes(estado, reembolsablesQueRevisa(req)))
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /soportes-tramitador/archivos/:id/ver
  static verArchivo = async (req: Request, res: Response) => {
    try {
      verificarQueLeCorresponde(req, await archivoEsReembolsable(Number(req.params.id)))
      await enviarArchivo(res, Number(req.params.id), null)
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /soportes-tramitador/:id/aprobar  { fechaReintegro? }
  static aprobar = async (req: Request, res: Response) => {
    try {
      const reembolsable = await soporteEsReembolsable(Number(req.params.id))
      verificarQueLeCorresponde(req, reembolsable)

      const soporte = await aprobarSoporte(Number(req.params.id), req.usuario.id, textoOpcional(req.body.fechaReintegro))
      res.json(
        soporte.tipo === TIPOS_SOPORTE.REINTEGRO ? 'Comprobante aprobado: el reintegro quedó registrado en la bolsa'
          : soporte.tipo === TIPOS_SOPORTE.OTRO ? 'Documento aprobado: quedó en los documentos del gasto'
            : 'Factura aprobada: ya puede registrar sus valores'
      )
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /soportes-tramitador/:id/rechazar  { motivo }
  static rechazar = async (req: Request, res: Response) => {
    try {
      verificarQueLeCorresponde(req, await soporteEsReembolsable(Number(req.params.id)))
      await rechazarSoporte(Number(req.params.id), req.usuario.id, req.body.motivo)
      res.json('Soporte rechazado: el tramitador verá el motivo en la app')
    } catch (error) {
      responderError(res, error)
    }
  }
}
