import JSZip from 'jszip'
import { PDFDocument } from 'pdf-lib'
import { Op } from 'sequelize'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import DocumentosGasto from '../../models/gastos/documentosGasto'
import TiposDocumentoGasto from '../../models/gastos/tiposDocumentoGasto'
import Reintegros from '../../models/gastos/reintegros'
import SoporteTramitador, { ESTADOS_SOPORTE } from '../../models/tramitadores/soporteTramitador'
import ArchivoSoporte from '../../models/tramitadores/archivoSoporte'
import { obtenerArchivo } from '../azureFileStorage'
import { ErrorGastos } from './errores'
import { TIPOS_DOCUMENTO } from './constantes'
import Operaciones from '../../models/operaciones'

export const MAXIMO_GASTOS_DESCARGA = 50

type ArchivoParaZip = { nombre: string, rutaDirectorio: string, nombreArchivo: string }
type ParteDelPdf = { nombre: string, rutaDirectorio: string, nombreArchivo: string, tipoArchivo: string }

// Nombre válido para un archivo dentro del ZIP (sin caracteres que Windows no acepta)
const limpiar = (texto: string, maximo = 80) =>
  texto.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, maximo).trim() || 'sin-nombre'

// "factura.pdf" repetido → "factura (2).pdf"
const nombreUnico = (usados: Set<string>, nombre: string) => {
  if (!usados.has(nombre.toLowerCase())) {
    usados.add(nombre.toLowerCase())
    return nombre
  }
  const punto = nombre.lastIndexOf('.')
  const base = punto > 0 ? nombre.slice(0, punto) : nombre
  const extension = punto > 0 ? nombre.slice(punto) : ''
  for (let i = 2; ; i++) {
    const candidato = `${base} (${i})${extension}`
    if (!usados.has(candidato.toLowerCase())) {
      usados.add(candidato.toLowerCase())
      return candidato
    }
  }
}

// "GAS-2026-000123" → "GAS2026000123"
const codigoPlano = (codigo: string) => codigo.replace(/-/g, '')

// PDF de pago de las operaciones marcadas: PLACA_CONCEPTO_GAS2026000123_pago.pdf
const nombrePdfPago = (gasto: SolicitudesGasto) =>
  `${limpiar(gasto.placa?.trim() ? gasto.placa.trim().toUpperCase() : 'SIN PLACA', 20)}_${limpiar(gasto.conceptoPago, 60)}_${codigoPlano(gasto.codigo)}_pago.pdf`

// Hoja carta (puntos): las imágenes se ajustan a ella sin deformarse
const CARTA = { ancho: 612, alto: 792, margen: 24 }

// Une PDFs e imágenes (JPG/PNG) en un solo PDF, en el orden recibido. Lo que no se pueda leer
// se devuelve en `fallidas` y el PDF sale con el resto
const unirEnPdf = async (partes: ParteDelPdf[]) => {
  const pdf = await PDFDocument.create()
  const fallidas: string[] = []

  for (const parte of partes) {
    try {
      const contenido = await obtenerArchivo(parte.rutaDirectorio, parte.nombreArchivo)
      if (parte.tipoArchivo === 'application/pdf') {
        const origen = await PDFDocument.load(contenido, { ignoreEncryption: true })
        for (const pagina of await pdf.copyPages(origen, origen.getPageIndices())) pdf.addPage(pagina)
      } else {
        const imagen = parte.tipoArchivo === 'image/png' ? await pdf.embedPng(contenido) : await pdf.embedJpg(contenido)
        const escala = Math.min((CARTA.ancho - 2 * CARTA.margen) / imagen.width, (CARTA.alto - 2 * CARTA.margen) / imagen.height, 1)
        const ancho = imagen.width * escala
        const alto = imagen.height * escala
        pdf.addPage([CARTA.ancho, CARTA.alto]).drawImage(imagen, { x: (CARTA.ancho - ancho) / 2, y: (CARTA.alto - alto) / 2, width: ancho, height: alto })
      }
    } catch {
      fallidas.push(parte.nombre)
    }
  }

  return { contenido: pdf.getPageCount() ? Buffer.from(await pdf.save()) : null, fallidas }
}

// ── PDF de pago unificado: qué lleva cada gasto ──
// Siempre las liquidaciones de pago; después, según lo que elija Legalización al descargar:
// el soporte de pago (lo sube Tesorería al pagar), la factura que registró Legalización, o ambos
// (en ese orden). Sin elección: la factura si el gasto la tiene registrada; si no, el soporte.
export type SegundoDocumento = 'SOPORTE' | 'FACTURA' | 'AMBOS'
export type EleccionPdfPago = Record<number, SegundoDocumento>

const CODIGOS_SEGUNDO: Record<SegundoDocumento, string[]> = {
  SOPORTE: [TIPOS_DOCUMENTO.SOPORTE_PAGO],
  FACTURA: ['FACTURA'],
  AMBOS: [TIPOS_DOCUMENTO.SOPORTE_PAGO, 'FACTURA']
}

type DocumentoDelGasto = { solicitudGastoId: number | null, nombreOriginal: string, tipoDocumento?: { codigo: string } | null }

const delTipo = (documentos: DocumentoDelGasto[], gastoId: number, codigo: string) =>
  documentos.filter(d => d.solicitudGastoId === gastoId && d.tipoDocumento?.codigo === codigo)

const sugerido = (documentos: DocumentoDelGasto[], gastoId: number): SegundoDocumento =>
  delTipo(documentos, gastoId, 'FACTURA').length ? 'FACTURA' : 'SOPORTE'

// Para la ventana de revisión antes de descargar: los gastos con PDF de pago unificado, con
// los documentos que tiene cada uno y lo sugerido. Vacío si ninguno lo lleva
export const revisionPdfsDePago = async (gastoIds: number[]) => {
  const gastos = await SolicitudesGasto.findAll({
    where: { id: [...new Set(gastoIds)].slice(0, MAXIMO_GASTOS_DESCARGA) },
    attributes: ['id', 'codigo', 'conceptoPago', 'placa'],
    include: [{ model: Operaciones, attributes: ['descargaPagoUnificada'], where: { descargaPagoUnificada: true } }],
    order: [['id', 'ASC']]
  })
  if (!gastos.length) return []

  const documentos = await DocumentosGasto.findAll({
    where: { solicitudGastoId: gastos.map(g => g.id) },
    attributes: ['id', 'solicitudGastoId', 'nombreOriginal', 'tipoArchivo'],
    include: [{ model: TiposDocumentoGasto, attributes: ['codigo'], where: { codigo: [TIPOS_DOCUMENTO.LIQUIDACION_PAGO, TIPOS_DOCUMENTO.SOPORTE_PAGO, 'FACTURA'] } }],
    order: [['createdAt', 'ASC']]
  })
  // Con id y tipo de archivo: la pantalla los muestra en una vista previa para decidir
  const nombres = (gastoId: number, codigo: string) =>
    (delTipo(documentos, gastoId, codigo) as typeof documentos).map(d => ({ id: d.id, nombre: d.nombreOriginal, tipo: d.tipoArchivo }))

  return gastos.map(g => ({
    id: g.id,
    codigo: g.codigo,
    archivo: nombrePdfPago(g),
    liquidaciones: nombres(g.id, TIPOS_DOCUMENTO.LIQUIDACION_PAGO),
    soportes: nombres(g.id, TIPOS_DOCUMENTO.SOPORTE_PAGO),
    facturas: nombres(g.id, 'FACTURA'),
    sugerido: sugerido(documentos, g.id)
  }))
}

// ZIP con los documentos de varios gastos, todos en la raíz (sin carpetas):
//  · Gastos de operaciones con descarga de pago unificada (Catálogos → Operaciones, hoy 1301): un
//    solo PDF por gasto, PLACA_CONCEPTO_GAS2026000123_pago.pdf, con las liquidaciones de pago y
//    después el soporte de pago, la factura registrada o ambos (`eleccion`, ver arriba). Si falta
//    algo, va lo que haya.
//  · Los demás gastos: cada documento con el código del gasto adelante (GAS2026000123_factura.pdf):
//    los del gasto y sus reintegros, los del pago (lote) y lo que subió el tramitador sin revisar.
// Lo que no se pudo leer o los gastos sin documentos se anotan en "LEEME - avisos.txt".
export const generarZipDocumentos = async (gastoIds: number[], eleccion: EleccionPdfPago = {}) => {
  const ids = [...new Set(gastoIds)].slice(0, MAXIMO_GASTOS_DESCARGA)

  const gastos = await SolicitudesGasto.findAll({
    where: { id: ids },
    attributes: ['id', 'codigo', 'conceptoPago', 'placa', 'lotePagoId'],
    include: [
      { model: Reintegros, attributes: ['id'] },
      { model: Operaciones, attributes: ['descargaPagoUnificada'] }
    ],
    order: [['id', 'ASC']]
  })
  if (gastos.length === 0) throw new ErrorGastos('No se encontraron los gastos seleccionados', 404)

  const reintegroIds = gastos.flatMap(g => (g.reintegros ?? []).map(r => r.id))
  const loteIds = [...new Set(gastos.map(g => g.lotePagoId).filter(Boolean))]

  const [documentos, soportesPendientes] = await Promise.all([
    DocumentosGasto.findAll({
      where: {
        [Op.or]: [
          { solicitudGastoId: ids },
          ...(reintegroIds.length ? [{ reintegroId: reintegroIds }] : []),
          ...(loteIds.length ? [{ lotePagoId: loteIds }] : [])
        ]
      },
      include: [{ model: TiposDocumentoGasto, attributes: ['nombre', 'codigo'] }],
      order: [['createdAt', 'ASC']]
    }),
    SoporteTramitador.findAll({
      where: { solicitudGastoId: ids, estado: ESTADOS_SOPORTE.PENDIENTE },
      include: [{ model: ArchivoSoporte }]
    })
  ])

  const zip = new JSZip()
  const usados = new Set<string>()
  const avisos: string[] = []
  let cantidad = 0

  const archivos: ArchivoParaZip[] = []
  for (const gasto of gastos) {
    const prefijo = codigoPlano(gasto.codigo)

    // Un solo PDF de pago: liquidaciones primero, luego lo elegido (soporte, factura o ambos)
    if (gasto.operacion?.descargaPagoUnificada) {
      const segundo = CODIGOS_SEGUNDO[eleccion[gasto.id]] ? eleccion[gasto.id] : sugerido(documentos, gasto.id)
      const partes = [TIPOS_DOCUMENTO.LIQUIDACION_PAGO, ...CODIGOS_SEGUNDO[segundo]]
        .flatMap(codigo => delTipo(documentos, gasto.id, codigo) as typeof documentos)
        .map(d => ({ nombre: d.nombreOriginal, rutaDirectorio: d.rutaDirectorio, nombreArchivo: d.nombreArchivo, tipoArchivo: d.tipoArchivo }))

      if (!partes.length) {
        avisos.push(`${gasto.codigo}: no tiene liquidación ni ${segundo === 'FACTURA' ? 'factura registrada' : segundo === 'AMBOS' ? 'soporte de pago ni factura' : 'soporte de pago'}`)
        continue
      }
      const { contenido, fallidas } = await unirEnPdf(partes)
      fallidas.forEach(nombre => avisos.push(`${gasto.codigo}: no se pudo leer "${nombre}"`))
      if (contenido) {
        zip.file(nombreUnico(usados, nombrePdfPago(gasto)), contenido)
        cantidad++
      }
      continue
    }

    const reintegrosDelGasto = (gasto.reintegros ?? []).map(r => r.id)
    const antes = archivos.length
    for (const d of documentos) {
      const esDelGasto = d.solicitudGastoId === gasto.id || (d.reintegroId && reintegrosDelGasto.includes(d.reintegroId))
      const esDelPago = d.lotePagoId && d.lotePagoId === gasto.lotePagoId
      if (!esDelGasto && !esDelPago) continue
      archivos.push({ nombre: `${prefijo}_${esDelPago ? 'pago_' : ''}${d.nombreOriginal}`, rutaDirectorio: d.rutaDirectorio, nombreArchivo: d.nombreArchivo })
    }
    for (const soporte of soportesPendientes.filter(s => s.solicitudGastoId === gasto.id)) {
      for (const a of soporte.archivos ?? []) {
        archivos.push({ nombre: `${prefijo}_tramitador-por-revisar_${a.nombreOriginal}`, rutaDirectorio: a.rutaDirectorio, nombreArchivo: a.nombreArchivo })
      }
    }
    if (archivos.length === antes) avisos.push(`${gasto.codigo}: no tiene documentos`)
  }

  // Se leen de Azure de a 5 para no saturar
  for (let i = 0; i < archivos.length; i += 5) {
    await Promise.all(archivos.slice(i, i + 5).map(async a => {
      try {
        const contenido = await obtenerArchivo(a.rutaDirectorio, a.nombreArchivo)
        zip.file(nombreUnico(usados, limpiar(a.nombre, 150)), contenido)
        cantidad++
      } catch {
        avisos.push(`No se pudo leer "${a.nombre}"`)
      }
    }))
  }

  if (avisos.length) {
    zip.file('LEEME - avisos.txt', `Avisos de la descarga:\r\n\r\n${avisos.join('\r\n')}\r\n`)
  }

  return {
    contenido: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } }),
    gastos: gastos.length,
    archivos: cantidad,
    faltantes: avisos.length
  }
}
