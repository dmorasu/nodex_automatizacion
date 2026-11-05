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

// PDF unificado de un gasto: PLACA_CONCEPTO_GAS2026000123_pago.pdf en las operaciones marcadas
// (PDF de pago, ej. 1301) y …_documentos.pdf en las demás
const nombrePdfPago = (gasto: SolicitudesGasto) =>
  `${limpiar(gasto.placa?.trim() ? gasto.placa.trim().toUpperCase() : 'SIN PLACA', 20)}_${limpiar(gasto.conceptoPago, 60)}_${codigoPlano(gasto.codigo)}_${gasto.operacion?.descargaPagoUnificada ? 'pago' : 'documentos'}.pdf`

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

// ── PDF unificado por gasto: qué documentos lleva ──
// Al descargar, quien descarga elige por gasto qué documentos se unen en un solo PDF: marca cada
// documento (sus ids) o tipos completos (sus códigos) (pedido del usuario, 2026-11-05; antes solo en
// las operaciones marcadas y con tres opciones fijas).
// Sin elección para un gasto: en las operaciones marcadas (ej. 1301) la liquidación y, después, la
// factura registrada si la tiene o si no el soporte de pago; en las demás, los documentos sueltos.
// Un gasto unificado baja solo con su PDF. Las partes van en el orden de ORDEN_TIPOS y luego el
// resto de tipos por nombre; dentro de un tipo, del más antiguo al más reciente.
// Se acepta también la elección de antes (SOPORTE | FACTURA | AMBOS).
export type SegundoDocumento = 'SOPORTE' | 'FACTURA' | 'AMBOS'
export type EleccionPdfPago = Record<number, (number | string)[] | SegundoDocumento>

const CODIGOS_SEGUNDO: Record<SegundoDocumento, string[]> = {
  SOPORTE: [TIPOS_DOCUMENTO.SOPORTE_PAGO],
  FACTURA: ['FACTURA'],
  AMBOS: [TIPOS_DOCUMENTO.SOPORTE_PAGO, 'FACTURA']
}

const ORDEN_TIPOS: string[] = [TIPOS_DOCUMENTO.LIQUIDACION_PAGO, TIPOS_DOCUMENTO.SOPORTE_PAGO, 'FACTURA']

type DocumentoDelGasto = {
  id?: number
  solicitudGastoId: number | null
  reintegroId?: number | null
  nombreOriginal: string
  tipoDocumento?: { codigo: string, nombre?: string } | null
}

// Documentos propios del gasto y de sus reintegros (los del lote y los del tramitador sin revisar no
// entran en el PDF unificado)
const delGasto = <T extends DocumentoDelGasto>(documentos: T[], gastoId: number, reintegroIds: number[]) =>
  documentos.filter(d => d.solicitudGastoId === gastoId || (d.reintegroId && reintegroIds.includes(d.reintegroId)))

const ordenTipo = (d: DocumentoDelGasto) => {
  const i = ORDEN_TIPOS.indexOf(d.tipoDocumento?.codigo ?? '')
  return i === -1 ? ORDEN_TIPOS.length : i
}
// Estable: dentro de un tipo conserva el orden de llegada (del más antiguo al más reciente)
const ordenar = <T extends DocumentoDelGasto>(documentos: T[]) => [...documentos].sort((a, b) =>
  ordenTipo(a) - ordenTipo(b) || (a.tipoDocumento?.nombre ?? '').localeCompare(b.tipoDocumento?.nombre ?? '', 'es'))

// Lo sugerido en las operaciones con PDF de pago: liquidación + factura registrada o, si no, el soporte
const sugeridoPago = (propios: DocumentoDelGasto[]) => [
  TIPOS_DOCUMENTO.LIQUIDACION_PAGO,
  ...(propios.some(d => d.tipoDocumento?.codigo === 'FACTURA') ? ['FACTURA'] : [TIPOS_DOCUMENTO.SOPORTE_PAGO])
]

// Documentos del gasto que se unen en su PDF, en orden (null = documentos sueltos). La elección es
// una lista de ids de documento y/o códigos de tipo; solo cuentan los documentos propios del gasto
const documentosElegidos = <T extends DocumentoDelGasto>(gasto: SolicitudesGasto, propios: T[], eleccion: EleccionPdfPago): T[] | null => {
  const elegido = eleccion[gasto.id]
  let quedan: T[]
  if (Array.isArray(elegido)) {
    if (!elegido.length) return null
    quedan = propios.filter(d => (d.id !== undefined && elegido.includes(d.id)) || elegido.includes(d.tipoDocumento?.codigo ?? ''))
  } else {
    const tipos = typeof elegido === 'string' && CODIGOS_SEGUNDO[elegido]
      ? [TIPOS_DOCUMENTO.LIQUIDACION_PAGO, ...CODIGOS_SEGUNDO[elegido]]
      : gasto.operacion?.descargaPagoUnificada ? sugeridoPago(propios) : null
    if (!tipos) return null
    quedan = propios.filter(d => tipos.includes(d.tipoDocumento?.codigo ?? ''))
  }
  return ordenar(quedan)
}

// Documentos de los gastos y de sus reintegros (y, si se piden, los del lote de pago)
const documentosDeLosGastos = (gastos: SolicitudesGasto[], conLotes: boolean) => {
  const reintegroIds = gastos.flatMap(g => (g.reintegros ?? []).map(r => r.id))
  const loteIds = conLotes ? [...new Set(gastos.map(g => g.lotePagoId).filter(Boolean))] : []
  return DocumentosGasto.findAll({
    where: {
      [Op.or]: [
        { solicitudGastoId: gastos.map(g => g.id) },
        ...(reintegroIds.length ? [{ reintegroId: reintegroIds }] : []),
        ...(loteIds.length ? [{ lotePagoId: loteIds }] : [])
      ]
    },
    include: [{ model: TiposDocumentoGasto, attributes: ['nombre', 'codigo'] }],
    order: [['createdAt', 'ASC']]
  })
}

// Para la ventana de revisión antes de descargar: cada gasto con sus documentos (propios y de sus
// reintegros, con su tipo) y los tipos que vienen marcados
export const revisionPdfsDePago = async (gastoIds: number[]) => {
  const gastos = await SolicitudesGasto.findAll({
    where: { id: [...new Set(gastoIds)].slice(0, MAXIMO_GASTOS_DESCARGA) },
    attributes: ['id', 'codigo', 'conceptoPago', 'placa', 'lotePagoId'],
    include: [{ model: Reintegros, attributes: ['id'] }, { model: Operaciones, attributes: ['nombreOperacion', 'centroDeCostos', 'descargaPagoUnificada'] }],
    order: [['id', 'ASC']]
  })
  if (!gastos.length) return []
  const documentos = await documentosDeLosGastos(gastos, false)

  return gastos.map(g => {
    const propios = ordenar(delGasto(documentos, g.id, (g.reintegros ?? []).map(r => r.id)))
    return {
      id: g.id,
      codigo: g.codigo,
      operacion: g.operacion?.nombreOperacion ?? null,
      centroDeCostos: g.operacion?.centroDeCostos ?? null,
      archivo: nombrePdfPago(g),
      pdfDePago: Boolean(g.operacion?.descargaPagoUnificada),
      // Con id y tipo de archivo: la pantalla los muestra en una vista previa para decidir
      documentos: propios.map(d => ({
        id: d.id,
        nombre: d.nombreOriginal,
        tipo: d.tipoArchivo,
        codigoTipo: d.tipoDocumento?.codigo ?? 'OTRO',
        nombreTipo: d.tipoDocumento?.nombre ?? 'Otro'
      })),
      sugerido: g.operacion?.descargaPagoUnificada ? sugeridoPago(propios) : []
    }
  })
}

// ZIP con los documentos de varios gastos, todos en la raíz (sin carpetas):
//  · Gastos unificados (los elegidos en la revisión o, sin elección, los de operaciones con PDF de
//    pago, ver arriba): un solo PDF por gasto con los tipos elegidos. Si falta algo, va lo que haya.
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

  const [documentos, soportesPendientes] = await Promise.all([
    documentosDeLosGastos(gastos, true),
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

    const reintegrosDelGasto = (gasto.reintegros ?? []).map(r => r.id)

    // Un solo PDF con los documentos elegidos, en orden (liquidación, soporte de pago, factura, …)
    const propios = delGasto(documentos, gasto.id, reintegrosDelGasto)
    const elegidos = documentosElegidos(gasto, propios, eleccion)
    if (elegidos) {
      const partes = elegidos
        .map(d => ({ nombre: d.nombreOriginal, rutaDirectorio: d.rutaDirectorio, nombreArchivo: d.nombreArchivo, tipoArchivo: d.tipoArchivo }))
      if (!partes.length) {
        avisos.push(`${gasto.codigo}: no tiene los documentos elegidos para el PDF`)
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
