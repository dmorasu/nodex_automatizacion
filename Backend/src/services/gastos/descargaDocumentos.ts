import JSZip from 'jszip'
import { Op } from 'sequelize'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import DocumentosGasto from '../../models/gastos/documentosGasto'
import TiposDocumentoGasto from '../../models/gastos/tiposDocumentoGasto'
import Reintegros from '../../models/gastos/reintegros'
import SoporteTramitador, { ESTADOS_SOPORTE } from '../../models/tramitadores/soporteTramitador'
import ArchivoSoporte from '../../models/tramitadores/archivoSoporte'
import { obtenerArchivo } from '../azureFileStorage'
import { ErrorGastos } from './errores'

export const MAXIMO_GASTOS_DESCARGA = 50

type ArchivoParaZip = { carpeta: string, nombre: string, rutaDirectorio: string, nombreArchivo: string }

// Nombre válido para carpeta/archivo dentro del ZIP (sin caracteres que Windows no acepta)
const limpiar = (texto: string, maximo = 80) =>
  texto.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, maximo) || 'sin-nombre'

// "factura.pdf" repetido en la misma carpeta → "factura (2).pdf"
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

// ZIP con los documentos de varios gastos: una carpeta por gasto ("GAS-2026-000012 - Concepto") con
//  · los documentos del gasto (factura, otros) y de sus reintegros
//  · "Pago/": los soportes del pago (están en el lote de pago)
//  · "Tramitador (por revisar)/": lo que subió el tramitador y aún no se ha aprobado
// Si un archivo no se puede leer de Azure, se anota en "LEEME - archivos faltantes.txt" y sigue.
export const generarZipDocumentos = async (gastoIds: number[]) => {
  const ids = [...new Set(gastoIds)].slice(0, MAXIMO_GASTOS_DESCARGA)

  const gastos = await SolicitudesGasto.findAll({
    where: { id: ids },
    attributes: ['id', 'codigo', 'conceptoPago', 'lotePagoId'],
    include: [{ model: Reintegros, attributes: ['id'] }],
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
      include: [{ model: TiposDocumentoGasto, attributes: ['nombre'] }],
      order: [['createdAt', 'ASC']]
    }),
    SoporteTramitador.findAll({
      where: { solicitudGastoId: ids, estado: ESTADOS_SOPORTE.PENDIENTE },
      include: [{ model: ArchivoSoporte }]
    })
  ])

  // Qué archivo va en qué carpeta
  const archivos: ArchivoParaZip[] = []
  for (const gasto of gastos) {
    const carpeta = limpiar(`${gasto.codigo} - ${gasto.conceptoPago}`)
    const reintegrosDelGasto = (gasto.reintegros ?? []).map(r => r.id)

    for (const d of documentos) {
      const esDelGasto = d.solicitudGastoId === gasto.id || (d.reintegroId && reintegrosDelGasto.includes(d.reintegroId))
      const esDelPago = d.lotePagoId && d.lotePagoId === gasto.lotePagoId
      if (!esDelGasto && !esDelPago) continue
      archivos.push({
        carpeta: esDelPago ? `${carpeta}/Pago` : carpeta,
        nombre: d.nombreOriginal,
        rutaDirectorio: d.rutaDirectorio,
        nombreArchivo: d.nombreArchivo
      })
    }

    for (const soporte of soportesPendientes.filter(s => s.solicitudGastoId === gasto.id)) {
      for (const a of soporte.archivos ?? []) {
        archivos.push({ carpeta: `${carpeta}/Tramitador (por revisar)`, nombre: a.nombreOriginal, rutaDirectorio: a.rutaDirectorio, nombreArchivo: a.nombreArchivo })
      }
    }
  }

  const zip = new JSZip()
  const usadosPorCarpeta = new Map<string, Set<string>>()
  const faltantes: string[] = []

  // Se leen de Azure de a 5 para no saturar
  for (let i = 0; i < archivos.length; i += 5) {
    await Promise.all(archivos.slice(i, i + 5).map(async a => {
      try {
        const contenido = await obtenerArchivo(a.rutaDirectorio, a.nombreArchivo)
        const usados = usadosPorCarpeta.get(a.carpeta) ?? new Set<string>()
        usadosPorCarpeta.set(a.carpeta, usados)
        zip.file(`${a.carpeta}/${nombreUnico(usados, limpiar(a.nombre, 150))}`, contenido)
      } catch {
        faltantes.push(`${a.carpeta}/${a.nombre}`)
      }
    }))
  }

  // Gastos sin ningún documento: carpeta vacía para que se note
  for (const gasto of gastos) {
    const carpeta = limpiar(`${gasto.codigo} - ${gasto.conceptoPago}`)
    if (!archivos.some(a => a.carpeta.startsWith(carpeta))) zip.folder(`${carpeta} (sin documentos)`)
  }

  if (faltantes.length) {
    zip.file('LEEME - archivos faltantes.txt', `Estos archivos no se pudieron leer del almacenamiento:\r\n\r\n${faltantes.join('\r\n')}\r\n`)
  }

  return {
    contenido: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } }),
    gastos: gastos.length,
    archivos: archivos.length - faltantes.length,
    faltantes: faltantes.length
  }
}
