import XLSX from 'xlsx'
import type { SaldoCliente, arqueoDeBolsa, estadoDeCuentaCliente } from './anticipos'

// =====================================
// EXCEL DEL ARQUEO DE UNA BOLSA DE ANTICIPOS
// Para el cierre del día: saldos de todos los clientes y estado de cuenta de uno.
// =====================================

const MONEDA = '"$"#,##0.00'

export const fechaHora = (iso: string | Date | null | undefined) =>
  iso ? new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' }) : ''

// Hoja con encabezados en español, ancho según el contenido y formato de moneda en `moneda`
export const hoja = (filas: Record<string, unknown>[], moneda: string[], encabezado: unknown[][] = []) => {
  const ws = XLSX.utils.aoa_to_sheet(encabezado)
  XLSX.utils.sheet_add_json(ws, filas.length ? filas : [{ 'Sin datos': '' }], { origin: encabezado.length ? encabezado.length + 1 : 0 })
  const columnas = Object.keys(filas[0] ?? { 'Sin datos': '' })
  ws['!cols'] = columnas.map(c => ({ wch: Math.min(50, Math.max(c.length, ...filas.map(f => String(f[c] ?? '').length)) + 2) }))
  const inicio = encabezado.length ? encabezado.length + 2 : 1
  columnas.forEach((c, col) => {
    if (!moneda.includes(c)) return
    for (let r = inicio; r < inicio + filas.length; r++) {
      const celda = ws[XLSX.utils.encode_cell({ r, c: col })]
      if (celda && typeof celda.v === 'number') celda.z = MONEDA
    }
  })
  // Moneda también en el resumen de arriba (segunda columna)
  encabezado.forEach((fila, r) => {
    const celda = ws[XLSX.utils.encode_cell({ r, c: 1 })]
    if (celda && typeof celda.v === 'number' && typeof fila[0] === 'string' && !/clientes/i.test(fila[0])) celda.z = MONEDA
  })
  return ws
}

const filaCliente = (c: SaldoCliente) => ({
  Cliente: c.nombre,
  'Tipo de identificación': c.tipoIdentificacion,
  'Identificación': c.identificacion,
  'Pagó (anticipos)': c.ingresado,
  'Gastos pagados': c.pagado,
  'Reintegros y ajustes': c.otros,
  Saldo: c.saldo,
  'Por pagar': c.comprometido,
  Disponible: c.disponible,
  Situación: c.disponible < 0 ? 'Faltante' : c.disponible > 0 && c.comprometido === 0 ? 'Sobrante' : c.comprometido > 0 ? 'Con gastos por pagar' : 'En cero',
  'Último movimiento': fechaHora(c.ultimoMovimiento)
})

export const generarExcelArqueo = (
  bolsa: { nombre: string, saldoActual: string },
  arqueo: Awaited<ReturnType<typeof arqueoDeBolsa>>
) => {
  const libro = XLSX.utils.book_new()
  const t = arqueo.totales
  const resumen = [
    [`Arqueo de la bolsa ${bolsa.nombre}`, ''],
    ['Generado', fechaHora(new Date())],
    ['Saldo de la bolsa', Number(bolsa.saldoActual)],
    ['Suma de los clientes', t.saldo],
    ['Diferencia (debe ser 0)', t.diferencia],
    ['Gastos por pagar', t.comprometido],
    ['Sobrantes', t.sobrantes],
    ['Faltantes', t.faltantes],
    ['Clientes', t.clientes]
  ]
  XLSX.utils.book_append_sheet(libro, hoja(arqueo.clientes.map(filaCliente),
    ['Pagó (anticipos)', 'Gastos pagados', 'Reintegros y ajustes', 'Saldo', 'Por pagar', 'Disponible'], resumen), 'Arqueo')
  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

const NOMBRES_TIPO: Record<string, string> = {
  ANTICIPO: 'Pago del cliente (anticipo)', PAGO: 'Pago de gasto', REINTEGRO: 'Reintegro', AJUSTE: 'Ajuste', REVERSO: 'Reverso'
}

export const generarExcelEstadoCuenta = (
  bolsa: { nombre: string },
  e: Awaited<ReturnType<typeof estadoDeCuentaCliente>>
) => {
  const libro = XLSX.utils.book_new()
  const s = e.saldo
  const resumen = [
    [`Estado de cuenta de ${e.cliente.nombre} (${e.cliente.tipoIdentificacion} ${e.cliente.identificacion})`, ''],
    ['Bolsa', bolsa.nombre],
    ['Período', e.periodo.desde || e.periodo.hasta ? `${e.periodo.desde ?? 'inicio'} a ${e.periodo.hasta ?? 'hoy'}` : 'Todo'],
    ['Generado', fechaHora(new Date())],
    ['Saldo inicial del período', e.periodo.saldoInicial],
    ['Entradas', e.periodo.entradas],
    ['Salidas', e.periodo.salidas],
    ['Saldo final del período', e.periodo.saldoFinal],
    ['Gastos por pagar (hoy)', s?.comprometido ?? 0],
    ['Disponible (hoy)', s?.disponible ?? 0]
  ]
  const movimientos = e.movimientos.map(m => ({
    Fecha: fechaHora(m.fecha),
    Tipo: NOMBRES_TIPO[String(m.tipo)] ?? m.tipo,
    Anticipo: m.anticipoCodigo ?? '',
    'Recibo de caja': m.tipo === 'ANTICIPO' ? (m.reciboCaja ?? '') : '',
    Gasto: m.gastoCodigo ?? '',
    Concepto: (m.tipo === 'ANTICIPO' ? m.anticipoConcepto : m.gastoConcepto) ?? m.observacion ?? '',
    Beneficiario: m.beneficiario ?? '',
    Lote: m.lotePagoId ? `#${m.lotePagoId}` : '',
    Entra: m.valor > 0 ? m.valor : '',
    Sale: m.valor < 0 ? -m.valor : '',
    Saldo: m.saldo,
    Usuario: m.usuario ?? ''
  }))
  XLSX.utils.book_append_sheet(libro, hoja(movimientos, ['Entra', 'Sale', 'Saldo'], resumen), 'Movimientos')
  XLSX.utils.book_append_sheet(libro, hoja(e.porPagar.map(g => ({
    Gasto: g.codigo, Concepto: g.concepto, Anticipo: g.anticipoCodigo ?? '', Estado: g.estado, Valor: g.valor, Creado: fechaHora(g.fecha)
  })), ['Valor']), 'Por pagar')
  XLSX.utils.book_append_sheet(libro, hoja(e.anticipos.map(a => ({
    Anticipo: a.codigo, Estado: a.estado, Concepto: a.concepto, 'Placa / matrícula': a.placa ?? a.matriculaInmobiliaria ?? '',
    'Fecha de consignación': a.fechaConsignacion, 'Valor consignado': Number(a.valorConsignado),
    'Valor recibido': a.valorRecibido === null ? '' : Number(a.valorRecibido), 'Recibo de caja': a.reciboCaja ?? ''
  })), ['Valor consignado', 'Valor recibido']), 'Anticipos')
  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
