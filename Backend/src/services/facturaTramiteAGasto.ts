import { QueryTypes } from 'sequelize'
import { db } from '../config/db'
import DocumentosGasto from '../models/gastos/documentosGasto'
import TiposDocumentoGasto from '../models/gastos/tiposDocumentoGasto'
import SolicitudesGasto from '../models/gastos/solicitudesGasto'
import { subirArchivo, eliminarArchivo } from './azureFileStorage'
import { nombreSeguro } from '../controllers/gastos/DocumentosGastoController'
import { registrarTrazabilidad } from './gastos/estadosGasto'
import { ESTADOS_GASTO } from './gastos/constantes'
import { ErrorGastos } from './gastos/errores'

// =====================================
// FACTURA CARGADA EN EL TRÁMITE → TAMBIÉN AL GASTO (pedido del usuario, 2026-11-05)
// Cuando Torre de control sube una factura en los documentos del trámite, puede mandarla también
// al gasto del trámite: queda como documento "Factura" del gasto, igual que cuando Legalización
// aprueba la factura que sube el tramitador. Así Legalización (o Contabilidad, si no es
// reembolsable) solo registra los datos de la factura para legalizarlo.
// Solo a gastos del mismo trámite.
// =====================================

// Estados en que el gasto ya no recibe documentos (igual que DocumentosGastoController)
const ESTADOS_SIN_DOCUMENTOS: string[] = [ESTADOS_GASTO.ANULADO, ESTADOS_GASTO.CONTABILIZADO, ESTADOS_GASTO.EN_REEMBOLSO, ESTADOS_GASTO.LEGALIZADO_CAJA]

export type GastoParaFactura = {
  id: number
  codigo: string
  conceptoPago: string
  valor: string
  estado: string
  codigoEstado: string
  facturas: number            // documentos Factura que ya tiene
  facturaRegistrada: boolean  // Legalización ya registró los datos de la factura
  puedeRecibir: boolean
}

// Gastos del trámite (sin anulados), con lo que hace falta para elegir a cuál va la factura
export const gastosParaFactura = async (solicitudTramiteId: number): Promise<GastoParaFactura[]> => {
  const filas = await db.query<Omit<GastoParaFactura, 'puedeRecibir'>>(`
    SELECT g.id, g.codigo, g.concepto_pago AS "conceptoPago",
      COALESCE(g.valor_realmente_pagado, g.valor_solicitado_pago)::text AS valor,
      e.nombre AS estado, e.codigo AS "codigoEstado",
      (SELECT COUNT(*)::int FROM gastos_documentos d JOIN gastos_tipos_documento_gasto t ON t.id = d.tipo_documento_id
        WHERE d.solicitud_gasto_id = g.id AND t.codigo = 'FACTURA') AS facturas,
      EXISTS (SELECT 1 FROM gastos_facturas f WHERE f.solicitud_gasto_id = g.id) AS "facturaRegistrada"
    FROM gastos_solicitudes g
    JOIN gastos_estados_gasto e ON e.id = g.estado_id
    WHERE g.solicitud_tramite_id = :solicitudTramiteId AND e.codigo <> :anulado
    ORDER BY g.id
  `, { type: QueryTypes.SELECT, replacements: { solicitudTramiteId, anulado: ESTADOS_GASTO.ANULADO } })
  return filas.map(f => ({ ...f, id: Number(f.id), puedeRecibir: !ESTADOS_SIN_DOCUMENTOS.includes(f.codigoEstado) }))
}

// Revisa antes de subir nada al trámite: el gasto es de este trámite y todavía recibe documentos
export const validarGastoParaFactura = async (solicitudTramiteId: number, solicitudGastoId: number) => {
  const gasto = (await gastosParaFactura(solicitudTramiteId)).find(g => g.id === solicitudGastoId)
  if (!gasto) throw new ErrorGastos('Ese gasto no es de este trámite')
  if (!gasto.puedeRecibir) throw new ErrorGastos(`El gasto ${gasto.codigo} está ${gasto.estado.toLowerCase()}: ya no se le pueden agregar documentos`)
  return gasto
}

// Copia los archivos al gasto como documento "Factura" y lo anota en la trazabilidad del gasto
export const copiarFacturaAlGasto = async (
  solicitudTramiteId: number,
  solicitudGastoId: number,
  archivos: Express.Multer.File[],
  usuarioId: number
) => {
  const gasto = await validarGastoParaFactura(solicitudTramiteId, solicitudGastoId)
  const tipo = await TiposDocumentoGasto.findOne({ where: { codigo: 'FACTURA' }, attributes: ['id'] })
  if (!tipo) throw new ErrorGastos('Falta el tipo de documento Factura en el catálogo de Gastos', 500)

  // Misma carpeta que los documentos que se suben desde el gasto
  const rutaDirectorio = `gastos/${gasto.codigo}`
  const subidos: string[] = []
  try {
    for (const archivo of archivos) {
      const nombreArchivo = nombreSeguro(archivo.originalname)
      await subirArchivo(rutaDirectorio, nombreArchivo, archivo.buffer)
      subidos.push(nombreArchivo)
    }
    await db.transaction(async transaction => {
      await DocumentosGasto.bulkCreate(archivos.map((archivo, i) => ({
        solicitudGastoId,
        tipoDocumentoId: tipo.id,
        nombreOriginal: archivo.originalname,
        nombreArchivo: subidos[i],
        rutaDirectorio,
        tipoArchivo: archivo.mimetype,
        tamano: archivo.size,
        subidoPor: usuarioId
      })), { transaction })
      const actual = await SolicitudesGasto.findByPk(solicitudGastoId, { attributes: ['id', 'estadoId'], transaction })
      await registrarTrazabilidad({
        solicitudGastoId,
        estadoAnteriorId: actual!.estadoId,
        estadoNuevoId: actual!.estadoId,
        usuarioId,
        observacion: `Factura cargada desde los documentos del trámite #${solicitudTramiteId} (${archivos.map(a => a.originalname).join(', ')})`
      }, transaction)
    })
    return gasto
  } catch (error) {
    await Promise.allSettled(subidos.map(nombre => eliminarArchivo(rutaDirectorio, nombre)))
    throw error
  }
}
