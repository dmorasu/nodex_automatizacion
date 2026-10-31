import ExcelJS from 'exceljs'
import { Op, type WhereOptions } from 'sequelize'
import Anticipos from '../../models/gastos/anticipos'
import Terceros from '../../models/gastos/terceros'
import ClientesEmpresariales from '../../models/gastos/clientesEmpresariales'
import Operaciones from '../../models/operaciones'
import Usuarios from '../../models/usuarios'
import { CLASES_ANTICIPO, ESTADOS_ANTICIPO, PARAMETROS } from './constantes'
import { obtenerParametro } from './parametros'

// =====================================
// REPORTE DE ANTICIPOS POR CENTRO DE COSTOS (2026-10-31)
// Lo ven todas las analistas, con todo lo de la empresa (decisión del usuario). Tres grupos:
//  · Facturado: solicitudes de factura ya facturadas por Contabilidad
//  · Por facturar: solicitudes de factura por confirmar o con novedad
//  · Anticipos: los anticipos normales (no se facturan ni llevan IVA)
// Base = valor recibido (si Contabilidad ya lo confirmó) o el consignado; total = base + IVA.
// Las anuladas no cuentan.
// =====================================

export type FiltrosReporteAnticipos = { desde?: string | null, hasta?: string | null }

export const GRUPOS_REPORTE = {
  FACTURADO: 'Facturado',
  POR_FACTURAR: 'Por facturar',
  ANTICIPOS: 'Anticipos (no se facturan)'
} as const
type Grupo = keyof typeof GRUPOS_REPORTE

type Valores = { cantidad: number, base: number, iva: number, total: number }
const vacio = (): Valores => ({ cantidad: 0, base: 0, iva: 0, total: 0 })

export type FilaCentroCostos = {
  centroCostos: string
  operaciones: string[]
  grupos: Record<Grupo, Valores>
  total: Valores
}

const SIN_CENTRO = 'Sin centro de costos'
const NOMBRE_ESTADO: Record<string, string> = { POR_CONFIRMAR: 'Por confirmar', NOVEDAD: 'Con novedad', CONFIRMADO: 'Confirmado', FACTURADO: 'Facturado' }
const aCentavos = (valor: unknown) => Math.round(Number(valor ?? 0) * 100)

const grupoDe = (a: Anticipos): Grupo =>
  a.clase !== CLASES_ANTICIPO.FACTURA ? 'ANTICIPOS' : a.estado === ESTADOS_ANTICIPO.FACTURADO ? 'FACTURADO' : 'POR_FACTURAR'

const consultar = async (filtros: FiltrosReporteAnticipos) => {
  const condiciones: WhereOptions[] = [{ estado: { [Op.ne]: ESTADOS_ANTICIPO.ANULADO } }]
  if (filtros.desde) condiciones.push({ fechaConsignacion: { [Op.gte]: filtros.desde } })
  if (filtros.hasta) condiciones.push({ fechaConsignacion: { [Op.lte]: filtros.hasta } })

  const [anticipos, tarifaIva] = await Promise.all([
    Anticipos.findAll({
      where: { [Op.and]: condiciones },
      include: [
        { model: Operaciones, attributes: ['nombreOperacion', 'centroDeCostos'] },
        { model: Terceros, attributes: ['identificacion', 'nombre', 'ciudad'] },
        { model: ClientesEmpresariales, attributes: ['nombre'] },
        { model: Usuarios, as: 'creador', attributes: ['nombreUsuario'] }
      ],
      order: [['fechaConsignacion', 'ASC'], ['id', 'ASC']]
    }),
    obtenerParametro(PARAMETROS.IVA)
  ])

  // Valores en centavos de cada registro. Las solicitudes registradas antes del IVA (sin valor
  // guardado) se calculan con su tarifa o, si no la tienen, con la del parámetro
  return anticipos.map(a => {
    const base = aCentavos(a.valorRecibido ?? a.valorConsignado)
    const esFactura = a.clase === CLASES_ANTICIPO.FACTURA
    const porcentaje = esFactura ? Number(a.ivaPorcentaje ?? tarifaIva) : 0
    const iva = !esFactura ? 0 : a.ivaValor !== null && a.ivaValor !== undefined ? aCentavos(a.ivaValor) : Math.round(base * porcentaje)
    return { anticipo: a, grupo: grupoDe(a), base, porcentaje, iva, total: base + iva }
  })
}

// Resumen por centro de costos (en pesos), ordenado por centro de costos
export const reporteAnticipos = async (filtros: FiltrosReporteAnticipos) => {
  const filas = await consultar(filtros)
  const porCentro = new Map<string, FilaCentroCostos>()
  const totales: FilaCentroCostos = { centroCostos: 'Total', operaciones: [], grupos: { FACTURADO: vacio(), POR_FACTURAR: vacio(), ANTICIPOS: vacio() }, total: vacio() }

  const sumar = (destino: Valores, fila: { base: number, iva: number, total: number }) => {
    destino.cantidad++
    destino.base += fila.base
    destino.iva += fila.iva
    destino.total += fila.total
  }

  for (const fila of filas) {
    const centro = fila.anticipo.operacion?.centroDeCostos?.trim() || SIN_CENTRO
    if (!porCentro.has(centro)) {
      porCentro.set(centro, { centroCostos: centro, operaciones: [], grupos: { FACTURADO: vacio(), POR_FACTURAR: vacio(), ANTICIPOS: vacio() }, total: vacio() })
    }
    const destino = porCentro.get(centro)!
    const operacion = fila.anticipo.operacion?.nombreOperacion
    if (operacion && !destino.operaciones.includes(operacion)) destino.operaciones.push(operacion)
    for (const valores of [destino.grupos[fila.grupo], destino.total, totales.grupos[fila.grupo], totales.total]) sumar(valores, fila)
  }

  const enPesos = (v: Valores): Valores => ({ cantidad: v.cantidad, base: v.base / 100, iva: v.iva / 100, total: v.total / 100 })
  const convertir = (f: FilaCentroCostos): FilaCentroCostos => ({
    ...f,
    grupos: { FACTURADO: enPesos(f.grupos.FACTURADO), POR_FACTURAR: enPesos(f.grupos.POR_FACTURAR), ANTICIPOS: enPesos(f.grupos.ANTICIPOS) },
    total: enPesos(f.total)
  })

  const centros = [...porCentro.values()]
    // "Sin centro de costos" al final
    .sort((a, b) => (a.centroCostos === SIN_CENTRO ? 1 : 0) - (b.centroCostos === SIN_CENTRO ? 1 : 0) || a.centroCostos.localeCompare(b.centroCostos, 'es', { numeric: true }))
    .map(convertir)

  return { centros, totales: convertir(totales), filas }
}

// Excel: hoja Resumen (por centro de costos) y hoja Detalle (un registro por fila)
export const excelReporteAnticipos = async (filtros: FiltrosReporteAnticipos) => {
  const { centros, totales, filas } = await reporteAnticipos(filtros)
  const MONEDA = '"$"#,##0.00'
  const libro = new ExcelJS.Workbook()
  libro.creator = 'Nodex Gastos'

  // ── Resumen ──
  const resumen = libro.addWorksheet('Resumen', { views: [{ state: 'frozen', ySplit: 2 }] })
  const grupos = Object.keys(GRUPOS_REPORTE) as Grupo[]
  const columnas = [
    { titulo: 'Centro de costos', ancho: 18 },
    { titulo: 'Operaciones', ancho: 40 },
    ...grupos.flatMap(() => [{ titulo: 'Cantidad', ancho: 10 }, { titulo: 'Base', ancho: 16 }, { titulo: 'IVA', ancho: 14 }, { titulo: 'Total', ancho: 16 }]),
    { titulo: 'Cantidad', ancho: 10 }, { titulo: 'Base', ancho: 16 }, { titulo: 'IVA', ancho: 14 }, { titulo: 'Total', ancho: 16 }
  ]
  columnas.forEach((c, i) => { resumen.getColumn(i + 1).width = c.ancho })

  // Fila 1: nombre de cada grupo sobre sus cuatro columnas
  const grupoFila = resumen.getRow(1)
  ;[...grupos.map(g => GRUPOS_REPORTE[g]), 'Total general'].forEach((nombre, i) => {
    const desde = 3 + i * 4
    resumen.mergeCells(1, desde, 1, desde + 3)
    grupoFila.getCell(desde).value = nombre
    grupoFila.getCell(desde).alignment = { horizontal: 'center' }
  })
  resumen.getRow(2).values = columnas.map(c => c.titulo)
  for (const n of [1, 2]) {
    resumen.getRow(n).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    resumen.getRow(n).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } }
  }

  const valoresDe = (f: FilaCentroCostos) => [
    f.centroCostos,
    f.operaciones.join(', '),
    ...[...grupos.map(g => f.grupos[g]), f.total].flatMap(v => [v.cantidad, v.base, v.iva, v.total])
  ]
  for (const f of centros) resumen.addRow(valoresDe(f))
  const filaTotal = resumen.addRow(valoresDe(totales))
  filaTotal.font = { bold: true }
  // Formato de moneda en base, IVA y total de cada grupo
  for (let i = 0; i < grupos.length + 1; i++) {
    for (const desplazamiento of [1, 2, 3]) resumen.getColumn(3 + i * 4 + desplazamiento).numFmt = MONEDA
  }

  // ── Detalle ──
  const detalle = libro.addWorksheet('Detalle', { views: [{ state: 'frozen', ySplit: 1 }] })
  detalle.columns = [
    { header: 'Código', key: 'codigo', width: 18 },
    { header: 'Tipo', key: 'clase', width: 20 },
    { header: 'Situación', key: 'grupo', width: 24 },
    { header: 'Estado', key: 'estado', width: 14 },
    { header: 'Centro de costos', key: 'centro', width: 16 },
    { header: 'Operación', key: 'operacion', width: 28 },
    { header: 'Cliente', key: 'cliente', width: 30 },
    { header: 'Identificación cliente', key: 'idCliente', width: 18 },
    { header: 'Ciudad', key: 'ciudad', width: 24 },
    { header: 'Cliente empresarial', key: 'empresarial', width: 20 },
    { header: 'Vehículo / inmueble', key: 'tipo', width: 12 },
    { header: 'Placa / matrícula', key: 'identificacion', width: 16 },
    { header: 'Concepto', key: 'concepto', width: 30 },
    { header: 'Fecha consignación', key: 'fechaConsignacion', width: 14 },
    { header: 'Referencia de pago', key: 'referencia', width: 18 },
    { header: 'Valor consignado', key: 'consignado', width: 16, style: { numFmt: MONEDA } },
    { header: 'Valor recibido', key: 'recibido', width: 16, style: { numFmt: MONEDA } },
    { header: 'Base', key: 'base', width: 16, style: { numFmt: MONEDA } },
    { header: '% IVA', key: 'porcentaje', width: 8, style: { numFmt: '0.00%' } },
    { header: 'IVA', key: 'iva', width: 14, style: { numFmt: MONEDA } },
    { header: 'Total', key: 'total', width: 16, style: { numFmt: MONEDA } },
    { header: 'Número de factura', key: 'factura', width: 16 },
    { header: 'Fecha de facturación', key: 'fechaFacturacion', width: 14, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Recibo de caja', key: 'reciboCaja', width: 14 },
    { header: 'Registrado por', key: 'creador', width: 24 }
  ]
  for (const { anticipo: a, grupo, base, porcentaje, iva, total } of filas) {
    detalle.addRow({
      codigo: a.codigo,
      clase: a.clase === CLASES_ANTICIPO.FACTURA ? 'Solicitud de factura' : 'Anticipo',
      grupo: GRUPOS_REPORTE[grupo],
      estado: NOMBRE_ESTADO[a.estado] ?? a.estado,
      centro: a.operacion?.centroDeCostos,
      operacion: a.operacion?.nombreOperacion,
      cliente: a.cliente?.nombre,
      idCliente: a.cliente?.identificacion,
      ciudad: a.cliente?.ciudad,
      empresarial: a.clienteEmpresarial?.nombre,
      tipo: a.tipo === 'VEHICULO' ? 'Vehículo' : 'Inmueble',
      identificacion: a.placa ?? a.matriculaInmobiliaria,
      concepto: a.concepto,
      fechaConsignacion: a.fechaConsignacion,
      referencia: a.referenciaPago,
      consignado: Number(a.valorConsignado),
      recibido: a.valorRecibido === null ? null : Number(a.valorRecibido),
      base: base / 100,
      porcentaje: porcentaje || null,
      iva: iva / 100,
      total: total / 100,
      factura: a.numeroFactura,
      fechaFacturacion: a.fechaFacturacion,
      reciboCaja: a.reciboCaja,
      creador: a.creador?.nombreUsuario
    })
  }
  detalle.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  detalle.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } }
  detalle.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: detalle.columns.length } }

  return libro.xlsx.writeBuffer()
}
