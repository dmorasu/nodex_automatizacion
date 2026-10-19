import type { Request, Response } from 'express'
import path from 'path'
import DocumentosGasto from '../../models/gastos/documentosGasto'
import TiposDocumentoGasto from '../../models/gastos/tiposDocumentoGasto'
import LotesPago from '../../models/gastos/lotesPago'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import CuentasCobro from '../../models/gastos/cuentasCobro'
import Reintegros from '../../models/gastos/reintegros'
import Anticipos from '../../models/gastos/anticipos'
import { subirArchivo, obtenerArchivo, eliminarArchivo } from '../../services/azureFileStorage'
import { codigoEstadoGasto } from '../../services/gastos/estadosGasto'
import { ESTADOS_ANTICIPO, ESTADOS_GASTO, TIPOS_DOCUMENTO, ESTADOS_LOTE } from '../../services/gastos/constantes'
import { ErrorGastos } from '../../services/gastos/errores'
import { obtenerGastoConAcceso } from './SolicitudesGastoController'
import { esAdmin, esAuxiliarCaja, puedeVerTodos, responderError } from './utilidades'
import ReembolsosCaja from '../../models/gastos/reembolsosCaja'
import { cajaDelUsuario } from '../../services/gastos/cajaMenor'
import { generarZipDocumentos } from '../../services/gastos/descargaDocumentos'

const CARPETA_GASTOS = 'gastos'
const CARPETA_LOTES = 'gastos/lotes'
const CARPETA_CUENTAS = 'gastos/cuentas-cobro'

// (un gasto de caja menor ya reembolsado tampoco: su soporte quedó en el reembolso)
const ESTADOS_SIN_DOCUMENTOS: string[] = [ESTADOS_GASTO.ANULADO, ESTADOS_GASTO.CONTABILIZADO, ESTADOS_GASTO.EN_REEMBOLSO, ESTADOS_GASTO.LEGALIZADO_CAJA]

// "Factura Nº 12 (copia).PDF" → "1727800000000-Factura_N_12_copia.pdf"
export const nombreSeguro = (original: string) => {
  const extension = path.extname(original).toLowerCase()
  const base = path.basename(original, path.extname(original))
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'archivo'

  return `${Date.now()}-${base}${extension}`
}

// Sube los archivos a Azure y los registra. Si algo falla, borra de Azure
// lo que alcanzó a subir para no dejar archivos huérfanos.
const guardarArchivos = async (
  req: Request,
  rutaDirectorio: string,
  tipoDocumentoId: number,
  pertenece: { solicitudGastoId?: number, lotePagoId?: number, cuentaCobroId?: number, reintegroId?: number }
) => {
  const archivos = (req.files ?? []) as Express.Multer.File[]
  if (archivos.length === 0) throw new ErrorGastos('Debe seleccionar al menos un archivo')

  const subidos: string[] = []

  try {
    for (const archivo of archivos) {
      const nombreArchivo = nombreSeguro(archivo.originalname)
      await subirArchivo(rutaDirectorio, nombreArchivo, archivo.buffer)
      subidos.push(nombreArchivo)
    }

    await DocumentosGasto.bulkCreate(archivos.map((archivo, i) => ({
      ...pertenece,
      tipoDocumentoId,
      nombreOriginal: archivo.originalname,
      nombreArchivo: subidos[i],
      rutaDirectorio,
      tipoArchivo: archivo.mimetype,
      tamano: archivo.size,
      subidoPor: req.usuario.id
    })))

    return archivos.length
  } catch (error) {
    await Promise.allSettled(subidos.map(nombre => eliminarArchivo(rutaDirectorio, nombre)))
    throw error
  }
}

// Un documento de lote lo ve cualquier rol o quien creó alguno de los gastos del lote
const verificarAccesoLote = async (req: Request, lotePagoId: number) => {
  if (puedeVerTodos(req)) return

  const propio = await SolicitudesGasto.count({ where: { lotePagoId, creadoPor: req.usuario.id } })
  if (!propio) throw new ErrorGastos('El documento no existe', 404)
}

// Busca el documento y verifica acceso según a qué pertenece.
// soloLectura: los documentos de un gasto (y de sus reintegros) los ven también los de su área, como el gasto
const obtenerDocumentoConAcceso = async (req: Request, { soloLectura = false } = {}) => {
  const documento = await DocumentosGasto.findByPk(Number(req.params.documentoId))

  if (documento?.solicitudGastoId) {
    const gasto = await obtenerGastoConAcceso(req, documento.solicitudGastoId, { soloLectura })
    return { documento, gasto }
  }

  if (documento?.lotePagoId) {
    await verificarAccesoLote(req, documento.lotePagoId)
    return { documento, gasto: null }
  }

  // Cuentas de cobro: solo usuarios con rol (Legalización, Contabilidad, ...)
  if (documento?.cuentaCobroId) {
    if (!puedeVerTodos(req)) throw new ErrorGastos('El documento no existe', 404)
    return { documento, gasto: null }
  }

  // Reintegros: quien puede ver el gasto
  if (documento?.reintegroId) {
    const reintegro = await Reintegros.findByPk(documento.reintegroId)
    if (!reintegro) throw new ErrorGastos('El documento no existe', 404)
    const gasto = await obtenerGastoConAcceso(req, reintegro.solicitudGastoId, { soloLectura })
    return { documento, gasto }
  }

  // Soporte de consignación de un anticipo: quien lo registró o cualquier rol del módulo.
  // Solo se borra mientras el anticipo se puede corregir.
  if (documento?.anticipoId) {
    const anticipo = await Anticipos.findByPk(documento.anticipoId, { attributes: ['id', 'creadoPor', 'estado'] })
    if (!anticipo || (!puedeVerTodos(req) && anticipo.creadoPor !== req.usuario.id)) {
      throw new ErrorGastos('El documento no existe', 404)
    }
    const editable = [ESTADOS_ANTICIPO.POR_CONFIRMAR, ESTADOS_ANTICIPO.NOVEDAD].includes(anticipo.estado as 'NOVEDAD')
    return { documento, gasto: null, anticipoCerrado: !editable }
  }

  // Soporte de un reembolso de caja menor: cualquier rol del módulo o la auxiliar de esa caja.
  // No se elimina (queda como comprobante del reembolso legalizado)
  if (documento?.reembolsoCajaId) {
    const reembolso = await ReembolsosCaja.findByPk(documento.reembolsoCajaId, { attributes: ['bolsaId'] })
    const deSuCaja = esAuxiliarCaja(req) && (await cajaDelUsuario(req.usuario.id))?.id === reembolso?.bolsaId
    if (!reembolso || (!puedeVerTodos(req) && !deSuCaja)) throw new ErrorGastos('El documento no existe', 404)
    return { documento, gasto: null, reembolsoCerrado: true }
  }

  throw new ErrorGastos('El documento no existe', 404)
}

export class DocumentosGastoController {

  // POST /solicitudes/:id/documentos  (multipart: archivos[], tipoDocumentoId)
  static subir = async (req: Request, res: Response) => {
    try {
      const gasto = await obtenerGastoConAcceso(req, Number(req.params.id))

      if (ESTADOS_SIN_DOCUMENTOS.includes(await codigoEstadoGasto(gasto.estadoId))) {
        throw new ErrorGastos('No se pueden agregar documentos a un gasto anulado o contabilizado')
      }

      const tipoDocumento = await TiposDocumentoGasto.findByPk(Number(req.body.tipoDocumentoId))
      if (!tipoDocumento?.activo) throw new ErrorGastos('Debe seleccionar el tipo de documento')

      const cantidad = await guardarArchivos(
        req,
        `${CARPETA_GASTOS}/${gasto.codigo}`,
        tipoDocumento.id,
        { solicitudGastoId: gasto.id }
      )

      res.status(201).json(`${cantidad} documento(s) cargado(s) correctamente`)
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /lotes/:id/documentos  (multipart: archivos[]) — soporte del pago, solo Tesorería
  static subirALote = async (req: Request, res: Response) => {
    try {
      const lote = await LotesPago.findByPk(Number(req.params.id))
      if (!lote) throw new ErrorGastos('El lote de pago no existe', 404)
      if (lote.estado === ESTADOS_LOTE.RECHAZADO) throw new ErrorGastos('El lote fue rechazado: no recibe soportes')

      const tipoDocumento = await TiposDocumentoGasto.findOne({ where: { codigo: TIPOS_DOCUMENTO.SOPORTE_PAGO } })
      if (!tipoDocumento) throw new ErrorGastos('No existe el tipo de documento Soporte de pago', 500)

      const cantidad = await guardarArchivos(
        req,
        `${CARPETA_LOTES}/lote-${lote.id}`,
        tipoDocumento.id,
        { lotePagoId: lote.id }
      )

      res.status(201).json(`${cantidad} soporte(s) cargado(s) correctamente`)
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /cuentas-cobro/:id/documentos  (multipart: archivos[]) — solo Legalización
  static subirACuenta = async (req: Request, res: Response) => {
    try {
      const cuenta = await CuentasCobro.findByPk(Number(req.params.id))
      if (!cuenta) throw new ErrorGastos('La cuenta de cobro no existe', 404)

      const tipoDocumento = await TiposDocumentoGasto.findOne({ where: { codigo: TIPOS_DOCUMENTO.CUENTA_COBRO } })
      if (!tipoDocumento) throw new ErrorGastos('No existe el tipo de documento Cuenta de cobro', 500)

      const cantidad = await guardarArchivos(
        req,
        `${CARPETA_CUENTAS}/${cuenta.id}`,
        tipoDocumento.id,
        { cuentaCobroId: cuenta.id }
      )

      res.status(201).json(`${cantidad} documento(s) cargado(s) correctamente`)
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /reintegros/:id/documentos  (multipart: archivos[]) — soporte de la devolución
  static subirAReintegro = async (req: Request, res: Response) => {
    try {
      const reintegro = await Reintegros.findByPk(Number(req.params.id))
      if (!reintegro) throw new ErrorGastos('El reintegro no existe', 404)

      const gasto = await obtenerGastoConAcceso(req, reintegro.solicitudGastoId)

      const tipoDocumento = await TiposDocumentoGasto.findOne({ where: { codigo: TIPOS_DOCUMENTO.SOPORTE_REINTEGRO } })
      if (!tipoDocumento) throw new ErrorGastos('No existe el tipo de documento Soporte de reintegro', 500)

      const cantidad = await guardarArchivos(
        req,
        `${CARPETA_GASTOS}/${gasto.codigo}/reintegros`,
        tipoDocumento.id,
        { reintegroId: reintegro.id }
      )

      res.status(201).json(`${cantidad} soporte(s) cargado(s) correctamente`)
    } catch (error) {
      responderError(res, error)
    }
  }

  // POST /documentos/descargar  { gastoIds: number[] } → ZIP con una carpeta por gasto
  static descargarVarios = async (req: Request, res: Response) => {
    try {
      const { contenido, gastos, archivos, faltantes } = await generarZipDocumentos((req.body.gastoIds as unknown[]).map(Number))
      const fecha = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

      res.setHeader('Content-Type', 'application/zip')
      res.setHeader('Content-Disposition', `attachment; filename="documentos-gastos-${fecha}.zip"`)
      res.setHeader('Content-Length', contenido.length)
      // Para que el frontend informe qué se descargó
      res.setHeader('X-Gastos', String(gastos))
      res.setHeader('X-Archivos', String(archivos))
      res.setHeader('X-Faltantes', String(faltantes))
      res.send(contenido)
    } catch (error) {
      responderError(res, error)
    }
  }

  // GET /documentos/:documentoId/ver
  static ver = async (req: Request, res: Response) => {
    try {
      const { documento } = await obtenerDocumentoConAcceso(req, { soloLectura: true })

      const archivo = await obtenerArchivo(documento.rutaDirectorio, documento.nombreArchivo)

      res.setHeader('Content-Type', documento.tipoArchivo)
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(documento.nombreOriginal)}"`)
      res.setHeader('Content-Length', archivo.length)
      res.send(archivo)
    } catch (error) {
      responderError(res, error)
    }
  }

  // DELETE /documentos/:documentoId  (quien lo subió o ADMIN)
  static eliminar = async (req: Request, res: Response) => {
    try {
      const acceso = await obtenerDocumentoConAcceso(req)
      const { documento, gasto } = acceso

      if ('reembolsoCerrado' in acceso) {
        throw new ErrorGastos('El soporte de un reembolso de caja menor no se puede eliminar')
      }
      if ('anticipoCerrado' in acceso && acceso.anticipoCerrado) {
        throw new ErrorGastos('El anticipo ya fue confirmado o anulado: sus soportes no se pueden eliminar')
      }

      if (documento.subidoPor !== req.usuario.id && !esAdmin(req)) {
        throw new ErrorGastos('Solo quien subió el documento puede eliminarlo', 403)
      }

      if (gasto && ESTADOS_SIN_DOCUMENTOS.includes(await codigoEstadoGasto(gasto.estadoId))) {
        throw new ErrorGastos('No se pueden eliminar documentos de un gasto anulado o contabilizado')
      }

      await eliminarArchivo(documento.rutaDirectorio, documento.nombreArchivo)
      await documento.destroy()

      res.json('Documento eliminado')
    } catch (error) {
      responderError(res, error)
    }
  }
}
