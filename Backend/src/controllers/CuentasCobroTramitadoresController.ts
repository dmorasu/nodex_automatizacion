import type { Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { responderError } from './gastos/utilidades'
import { ESTADOS_CUENTA_TRAMITADOR as ESTADOS } from '../models/cuentasCobroTramitador/cuentaCobroTramitador'
import {
  agregarAdicionalTramitador,
  agregarLinea,
  anularCuenta,
  aprobarCuenta,
  autorUsuario,
  cuentasDelTramitador,
  darVistoBueno,
  detalleCuenta,
  detalleParaTramitador,
  editarLinea,
  enviarAlTramitador,
  firmaDelTramitador,
  generarPrecuentas,
  guardarFirma,
  listarCuentas,
  marcarPagada,
  pedirCorreccion,
  porGenerar,
  quitarLinea,
  retirarCuenta,
  soporteLinea,
  soportePago
} from '../services/cuentasCobroTramitador/cuentasCobro'
import { generarPdfCuenta } from '../services/cuentasCobroTramitador/pdfCuentaCobro'
import { generarExcelCuentasCobro } from '../services/cuentasCobroTramitador/excelCuentasCobro'
import {
  avisarEnTesoreria,
  avisarEnviada,
  avisarPagadaTorre,
  avisarPagadaTramitador,
  avisarRespuestaTramitador,
  avisarRetirada,
  avisarTesoreria
} from '../services/cuentasCobroTramitador/avisosCuentaCobro'
import { ErrorGastos } from '../services/gastos/errores'

const id = (req: Request) => Number(req.params.id)
const usuarioDe = (req: Request) => ({ id: Number(req.usuario.id), nombreUsuario: req.usuario.nombreUsuario })

const enviarPdf = async (res: Response, cuentaId: number, filtro?: (datos: { tramitadorId: number, estado: string }) => boolean) => {
  const pdf = await generarPdfCuenta(cuentaId)
  if (filtro && !filtro(pdf)) throw new ErrorGastos('La cuenta de cobro no existe', 404)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(pdf.nombre)}`)
  res.send(pdf.contenido)
}

const enviarArchivo = (res: Response, archivo: { contenido: Buffer, tipo: string, nombre: string }) => {
  res.setHeader('Content-Type', archivo.tipo)
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(archivo.nombre)}`)
  res.send(archivo.contenido)
}

// Soporte de pago o de un adicional (PDF o imagen, máximo 10 MB) en el campo "soporte"
const subida = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } })
export const recibirSoportePago = (req: Request, res: Response, next: NextFunction) =>
  subida.single('soporte')(req, res, error => {
    if (!error) return next()
    const mensaje = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 'El soporte puede pesar máximo 10 MB' : 'No se pudo recibir el soporte'
    res.status(400).json({ error: mensaje })
  })

// ── Torre de control (/api/cuentas-cobro-tramitadores) ──
export class CuentasCobroTorreController {

  static porGenerar = async (_req: Request, res: Response) => {
    try {
      res.json(await porGenerar())
    } catch (error) {
      responderError(res, error)
    }
  }

  static generar = async (req: Request, res: Response) => {
    try {
      const pedidas = (req.body.precuentas as { tramitadorId: unknown, semana: unknown }[]).map(p => ({ tramitadorId: Number(p.tramitadorId), semana: String(p.semana) }))
      res.json(await generarPrecuentas(pedidas, usuarioDe(req)))
    } catch (error) {
      responderError(res, error)
    }
  }

  static listar = async (req: Request, res: Response) => {
    try {
      const estados = String(req.query.estados ?? '').split(',').filter(e => Object.values(ESTADOS).includes(e as any))
      res.json(await listarCuentas({
        estados,
        tramitadorId: req.query.tramitadorId ? Number(req.query.tramitadorId) : undefined,
        q: req.query.q ? String(req.query.q) : undefined,
        pagina: req.query.pagina ? Number(req.query.pagina) : 1
      }))
    } catch (error) {
      responderError(res, error)
    }
  }

  // Excel con los mismos filtros de la pestaña (sin estados: todas las cuentas)
  static exportar = async (req: Request, res: Response) => {
    try {
      const estados = String(req.query.estados ?? '').split(',').filter(e => Object.values(ESTADOS).includes(e as any))
      const archivo = await generarExcelCuentasCobro(estados, req.query.q ? String(req.query.q) : undefined)
      const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="cuentas-cobro-tramitadores-${hoy}.xlsx"`)
      res.send(archivo)
    } catch (error) {
      responderError(res, error)
    }
  }

  static detalle = async (req: Request, res: Response) => {
    try {
      res.json(await detalleCuenta(id(req)))
    } catch (error) {
      responderError(res, error)
    }
  }

  static pdf = async (req: Request, res: Response) => {
    try {
      await enviarPdf(res, id(req))
    } catch (error) {
      responderError(res, error)
    }
  }

  static editarLinea = async (req: Request, res: Response) => {
    try {
      await editarLinea(id(req), Number(req.params.lineaId), req.body, autorUsuario(usuarioDe(req)))
      res.json(await detalleCuenta(id(req)))
    } catch (error) {
      responderError(res, error)
    }
  }

  static agregarLinea = async (req: Request, res: Response) => {
    try {
      await agregarLinea(id(req), { ...req.body, solicitudTramiteId: Number(req.body.solicitudTramiteId) }, autorUsuario(usuarioDe(req)))
      res.json(await detalleCuenta(id(req)))
    } catch (error) {
      responderError(res, error)
    }
  }

  static quitarLinea = async (req: Request, res: Response) => {
    try {
      await quitarLinea(id(req), Number(req.params.lineaId), autorUsuario(usuarioDe(req)))
      res.json(await detalleCuenta(id(req)))
    } catch (error) {
      responderError(res, error)
    }
  }

  static enviar = async (req: Request, res: Response) => {
    try {
      await enviarAlTramitador(id(req), usuarioDe(req))
      void avisarEnviada(id(req))
      res.json(await detalleCuenta(id(req)))
    } catch (error) {
      responderError(res, error)
    }
  }

  static retirar = async (req: Request, res: Response) => {
    try {
      const motivo = String(req.body.motivo ?? '')
      await retirarCuenta(id(req), motivo, usuarioDe(req))
      void avisarRetirada(id(req), false, motivo)
      res.json(await detalleCuenta(id(req)))
    } catch (error) {
      responderError(res, error)
    }
  }

  static anular = async (req: Request, res: Response) => {
    try {
      const motivo = String(req.body.motivo ?? '')
      const { estadoAnterior } = await anularCuenta(id(req), motivo, usuarioDe(req))
      // El tramitador solo se entera si ya la tenía en la app
      if (estadoAnterior === ESTADOS.CON_TRAMITADOR || estadoAnterior === ESTADOS.APROBADA) void avisarRetirada(id(req), true, motivo)
      res.json(await detalleCuenta(id(req)))
    } catch (error) {
      responderError(res, error)
    }
  }

  // Visto bueno de la semana (o de las cuentas elegidas)
  static vistoBueno = async (req: Request, res: Response) => {
    try {
      const cuentas = await darVistoBueno(req.body.cuentaIds.map(Number), usuarioDe(req))
      const ids = cuentas.map(c => c.id)
      void avisarTesoreria(ids, req.usuario.nombreUsuario)
      for (const cuentaId of ids) void avisarEnTesoreria(cuentaId)
      res.json({ mensaje: cuentas.length === 1 ? 'La cuenta pasó a Tesorería' : `${cuentas.length} cuentas pasaron a Tesorería` })
    } catch (error) {
      responderError(res, error)
    }
  }

  static soportePago = async (req: Request, res: Response) => {
    try {
      enviarArchivo(res, await soportePago(id(req)))
    } catch (error) {
      responderError(res, error)
    }
  }

  static soporteLinea = async (req: Request, res: Response) => {
    try {
      enviarArchivo(res, await soporteLinea(id(req), Number(req.params.lineaId)))
    } catch (error) {
      responderError(res, error)
    }
  }
}

// ── Tesorería (/api/gastos/cuentas-tramitadores) ──
export class CuentasCobroTesoreriaController {

  static listar = async (req: Request, res: Response) => {
    try {
      const estado = req.query.estado === ESTADOS.PAGADA ? ESTADOS.PAGADA : ESTADOS.EN_TESORERIA
      res.json(await listarCuentas({
        estados: [estado],
        q: req.query.q ? String(req.query.q) : undefined,
        pagina: req.query.pagina ? Number(req.query.pagina) : 1
      }))
    } catch (error) {
      responderError(res, error)
    }
  }

  // Tesorería solo ve las que ya pasaron el visto bueno
  private static visible = async (cuentaId: number) => {
    const detalle = await detalleCuenta(cuentaId)
    if (detalle.estado !== ESTADOS.EN_TESORERIA && detalle.estado !== ESTADOS.PAGADA) throw new ErrorGastos('La cuenta de cobro no existe', 404)
    return detalle
  }

  static detalle = async (req: Request, res: Response) => {
    try {
      res.json(await CuentasCobroTesoreriaController.visible(id(req)))
    } catch (error) {
      responderError(res, error)
    }
  }

  static pdf = async (req: Request, res: Response) => {
    try {
      await enviarPdf(res, id(req), ({ estado }) => estado === ESTADOS.EN_TESORERIA || estado === ESTADOS.PAGADA)
    } catch (error) {
      responderError(res, error)
    }
  }

  static pagar = async (req: Request, res: Response) => {
    try {
      await marcarPagada(id(req), { fechaPago: String(req.body.fechaPago ?? ''), observacion: req.body.observacion }, req.file, usuarioDe(req))
      void avisarPagadaTramitador(id(req))
      void avisarPagadaTorre(id(req))
      res.json(await CuentasCobroTesoreriaController.visible(id(req)))
    } catch (error) {
      responderError(res, error)
    }
  }

  static soportePago = async (req: Request, res: Response) => {
    try {
      await CuentasCobroTesoreriaController.visible(id(req))
      await CuentasCobroTorreController.soportePago(req, res)
    } catch (error) {
      responderError(res, error)
    }
  }
}

// ── App de tramitadores (/api/app-tramitadores/cuentas-cobro) ──
export class CuentasCobroAppController {

  static listar = async (req: Request, res: Response) => {
    try {
      res.json(await cuentasDelTramitador(req.sesionTramitador!.tramitadorId))
    } catch (error) {
      responderError(res, error)
    }
  }

  static detalle = async (req: Request, res: Response) => {
    try {
      res.json(await detalleParaTramitador(req.sesionTramitador!.tramitadorId, id(req)))
    } catch (error) {
      responderError(res, error)
    }
  }

  static pdf = async (req: Request, res: Response) => {
    try {
      const tramitadorId = req.sesionTramitador!.tramitadorId
      // detalleParaTramitador valida que sea suya y que ya se la hayan enviado
      await detalleParaTramitador(tramitadorId, id(req))
      await enviarPdf(res, id(req))
    } catch (error) {
      responderError(res, error)
    }
  }

  static aprobar = async (req: Request, res: Response) => {
    try {
      await aprobarCuenta(req.sesionTramitador!.tramitadorId, id(req))
      void avisarRespuestaTramitador(id(req), 'APROBADA')
      res.json({ mensaje: 'Cuenta de cobro aprobada' })
    } catch (error) {
      responderError(res, error)
    }
  }

  static corregir = async (req: Request, res: Response) => {
    try {
      const comentario = String(req.body.comentario ?? '')
      await pedirCorreccion(req.sesionTramitador!.tramitadorId, id(req), comentario)
      void avisarRespuestaTramitador(id(req), 'CORRECCION', comentario.trim())
      res.json({ mensaje: 'Enviamos su solicitud de corrección' })
    } catch (error) {
      responderError(res, error)
    }
  }

  static agregarAdicional = async (req: Request, res: Response) => {
    try {
      const { detalle } = await agregarAdicionalTramitador(req.sesionTramitador!.tramitadorId, id(req), {
        solicitudTramiteId: Number(req.body.solicitudTramiteId),
        concepto: String(req.body.concepto ?? ''),
        fecha: String(req.body.fecha ?? ''),
        valor: req.body.valor
      }, req.file)
      void avisarRespuestaTramitador(id(req), 'ADICIONAL', detalle)
      res.json({ mensaje: 'Adicional enviado a Torre de control para revisión' })
    } catch (error) {
      responderError(res, error)
    }
  }

  static guardarFirma = async (req: Request, res: Response) => {
    try {
      await guardarFirma(req.sesionTramitador!.tramitadorId, String(req.body.imagen ?? ''))
      res.json({ mensaje: 'Firma guardada' })
    } catch (error) {
      responderError(res, error)
    }
  }

  static firma = async (req: Request, res: Response) => {
    try {
      const imagen = await firmaDelTramitador(req.sesionTramitador!.tramitadorId)
      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', 'private, no-store')
      res.send(imagen)
    } catch (error) {
      responderError(res, error)
    }
  }
}
