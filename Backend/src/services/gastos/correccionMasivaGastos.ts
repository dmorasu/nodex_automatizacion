import ExcelJS from 'exceljs'
import { Op, type Order, type Transaction, type WhereOptions } from 'sequelize'
import { db } from '../../config/db'
import Bolsas from '../../models/gastos/bolsas'
import TiposGasto from '../../models/gastos/tiposGasto'
import FormasPago from '../../models/gastos/formasPago'
import EstadosGasto from '../../models/gastos/estadosGasto'
import LotesPago from '../../models/gastos/lotesPago'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import { registrarMovimientos, type Movimiento } from './bolsas'
import { codigoEstadoGasto, registrarTrazabilidad } from './estadosGasto'
import { identificacionPorTipo, prepararRetencion, RETENCION_VACIA, validarBolsaDelNuevoGasto } from './solicitudesGasto'
import { ESTADOS_GASTO, FORMA_PAGO_CAJA_MENOR, TIPOS_GASTO, TIPOS_MOVIMIENTO_BOLSA } from './constantes'
import { ErrorGastos } from './errores'
import { formatoMoneda } from './formato'

// =====================================
// CORRECCIÓN MASIVA DE GASTOS (Excel, solo Administrador de Gastos)
// Para corregir lo que entró mal (sobre todo por el cargue masivo): tipo de gasto, bolsa, valores
// y placa / tránsito / matrícula. El Excel sale con los gastos filtrados en el Tablero de Control
// y sus datos actuales; se cambia lo que esté mal y se sube. Solo se aplica lo que cambió.
// Decisiones del usuario (2026-10-28):
//  · Gastos desde Solicitado hasta Pagado (también Pagado por caja menor sin legalizar). Después
//    (factura, cuenta de cobro, legalización, contabilidad) no se corrigen aquí.
//  · Ya pagado: si cambia la bolsa, el pago se devuelve a la bolsa anterior (REVERSO) y se
//    descuenta de la nueva (PAGO); si cambia el valor pagado, la bolsa se ajusta por la
//    diferencia (AJUSTE), como en "Corregir valor", y el total del lote también.
//  · En un lote por pagar (Programado / Aprobado) no cambian bolsa ni valor: Dirección ya lo vio
//    con ese valor y el lote sale de una sola bolsa. Tesorería lo quita del lote y se corrige.
//  · Un motivo para todo el archivo; queda en el historial de cada gasto.
// Todo o nada: si una fila tiene error no se aplica ninguna.
// =====================================

export const MAXIMO_FILAS_CORRECCION = 500

const COLUMNAS: { clave: string, titulo: string, ancho: number, nota: string, editable: boolean }[] = [
  { clave: 'codigo', titulo: 'codigo', ancho: 18, nota: 'No lo cambie: identifica el gasto', editable: false },
  { clave: 'estado', titulo: 'estado', ancho: 18, nota: 'Solo informativo', editable: false },
  { clave: 'conceptoPago', titulo: 'conceptoPago', ancho: 30, nota: 'Solo informativo', editable: false },
  { clave: 'tipoGastoId', titulo: 'tipoGastoId', ancho: 12, nota: 'Hoja TiposGasto', editable: true },
  { clave: 'bolsaId', titulo: 'bolsaId', ancho: 9, nota: 'Hoja Bolsas', editable: true },
  { clave: 'valorSolicitado', titulo: 'valorSolicitado', ancho: 15, nota: 'Número sin puntos ni signo $ (ej: 150000)', editable: true },
  { clave: 'valorPagado', titulo: 'valorPagado', ancho: 15, nota: 'Solo gastos pagados. Vacío si aún no se ha pagado', editable: true },
  { clave: 'placa', titulo: 'placa', ancho: 10, nota: 'Obligatoria si el tipo es Vehículo', editable: true },
  { clave: 'transito', titulo: 'transito', ancho: 22, nota: 'Obligatorio si el tipo es Vehículo', editable: true },
  { clave: 'matriculaInmobiliaria', titulo: 'matriculaInmobiliaria', ancho: 20, nota: 'Obligatoria si el tipo es Inmueble', editable: true }
]

const ESTADOS_CORREGIBLES: string[] = [
  ESTADOS_GASTO.SOLICITADO, ESTADOS_GASTO.PROGRAMADO, ESTADOS_GASTO.APROBADO_PAGO,
  ESTADOS_GASTO.PAGADO, ESTADOS_GASTO.PAGADO_CAJA
]
const ESTADOS_EN_LOTE: string[] = [ESTADOS_GASTO.PROGRAMADO, ESTADOS_GASTO.APROBADO_PAGO]
const ESTADOS_PAGADOS: string[] = [ESTADOS_GASTO.PAGADO, ESTADOS_GASTO.PAGADO_CAJA]

export type ErrorFila = { fila: number, error: string }
export type CambioFila = { fila: number, codigo: string, cambios: string[] }

type Fila = { numero: number, valores: Record<string, string>, columnas: Set<string> }

const aCentavos = (valor: number | string | null | undefined) => Math.round(Number(valor ?? 0) * 100)
const moneda = (centavos: number) => formatoMoneda(centavos / 100)
const texto = (valor: unknown): string | null => String(valor ?? '').trim() || null


// =====================================
// PLANTILLA
// =====================================

// Excel con los gastos de los filtros del Tablero de Control y sus datos actuales
export const generarPlantillaCorreccion = async (where: WhereOptions, order: Order) => {
  const total = await SolicitudesGasto.count({ where })
  if (total === 0) throw new ErrorGastos('No hay gastos con esos filtros')
  if (total > MAXIMO_FILAS_CORRECCION) {
    throw new ErrorGastos(`Hay ${total} gastos con esos filtros; el máximo es ${MAXIMO_FILAS_CORRECCION}. Ajuste los filtros.`)
  }

  const [gastos, bolsas, tipos] = await Promise.all([
    SolicitudesGasto.findAll({
      where,
      include: [{ model: EstadosGasto, attributes: ['nombre'] }],
      attributes: ['id', 'codigo', 'conceptoPago', 'tipoGastoId', 'bolsaId', 'valorSolicitadoPago', 'valorRealmentePagado', 'placa', 'transito', 'matriculaInmobiliaria', 'createdAt'],
      order
    }),
    Bolsas.findAll({ where: { activo: true }, attributes: ['id', 'nombre', 'tipo', 'lineaNegocio'], order: [['nombre', 'ASC']] }),
    TiposGasto.findAll({ where: { activo: true }, attributes: ['id', 'nombre'], order: [['id', 'ASC']] })
  ])

  const libro = new ExcelJS.Workbook()
  libro.creator = 'Nodex'

  const hoja = libro.addWorksheet('Correccion', { views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }] })
  hoja.columns = COLUMNAS.map(c => ({ header: c.titulo, key: c.clave, width: c.ancho }))
  COLUMNAS.forEach((c, i) => { hoja.getRow(1).getCell(i + 1).note = c.nota })

  for (const g of gastos) {
    hoja.addRow({
      codigo: g.codigo,
      estado: g.estado?.nombre ?? '',
      conceptoPago: g.conceptoPago,
      tipoGastoId: g.tipoGastoId,
      bolsaId: g.bolsaId,
      valorSolicitado: Number(g.valorSolicitadoPago),
      valorPagado: g.valorRealmentePagado === null ? '' : Number(g.valorRealmentePagado),
      placa: g.placa ?? '',
      transito: g.transito ?? '',
      matriculaInmobiliaria: g.matriculaInmobiliaria ?? ''
    })
  }

  const encabezado = hoja.getRow(1)
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  COLUMNAS.forEach((c, i) => {
    // Las columnas que no se corrigen van en gris
    encabezado.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.editable ? 'FF059669' : 'FF94A3B8' } }
  })
  hoja.autoFilter = { from: 'A1', to: { row: 1, column: COLUMNAS.length } }

  const apoyo = (nombre: string, columnas: { header: string, key: string, width: number }[], filas: object[]) => {
    const h = libro.addWorksheet(nombre)
    h.columns = columnas
    h.addRows(filas)
    h.getRow(1).font = { bold: true }
  }
  apoyo('Bolsas', [{ header: 'id', key: 'id', width: 6 }, { header: 'nombre', key: 'nombre', width: 28 }, { header: 'tipo', key: 'tipo', width: 16 }, { header: 'lineaNegocio', key: 'lineaNegocio', width: 24 }],
    bolsas.map(b => ({ id: b.id, nombre: b.nombre, tipo: b.tipo, lineaNegocio: b.lineaNegocio })))
  apoyo('TiposGasto', [{ header: 'id', key: 'id', width: 6 }, { header: 'nombre', key: 'nombre', width: 28 }],
    tipos.map(t => ({ id: t.id, nombre: t.nombre })))

  const instrucciones = libro.addWorksheet('Instrucciones')
  instrucciones.columns = [{ header: 'Columna', key: 'columna', width: 24 }, { header: 'Cómo llenarla', key: 'nota', width: 90 }]
  instrucciones.addRows(COLUMNAS.map(c => ({ columna: c.titulo, nota: c.nota })))
  instrucciones.addRow({})
  instrucciones.addRow({ columna: 'Importante', nota: 'Cambie solo lo que esté mal. Puede borrar las filas que no necesite corregir y las columnas que no vaya a tocar (menos codigo).' })
  instrucciones.addRow({ columna: '', nota: 'Si alguna fila tiene error no se aplica ninguna corrección.' })
  instrucciones.addRow({ columna: '', nota: 'Gastos pagados: si cambia la bolsa, el pago vuelve a la bolsa anterior y se descuenta de la nueva; si cambia el valor pagado, la bolsa se ajusta por la diferencia.' })
  instrucciones.addRow({ columna: '', nota: 'Gastos en un lote por pagar (Programado o Aprobado): la bolsa y el valor no se cambian; Tesorería debe quitarlos del lote.' })
  instrucciones.getRow(1).font = { bold: true }

  return libro.xlsx.writeBuffer()
}


// =====================================
// LECTURA
// =====================================

// Valor de una celda como texto (las celdas de Excel pueden traer números, fórmulas, hipervínculos...)
const textoCelda = (valor: ExcelJS.CellValue): string => {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'object') {
    if ('result' in valor) return String(valor.result ?? '').trim()
    if ('text' in valor) return String(valor.text ?? '').trim()
    if ('richText' in valor) return valor.richText.map(t => t.text).join('').trim()
    if (valor instanceof Date) return valor.toISOString()
  }
  return String(valor).trim()
}

const leerArchivo = async (buffer: Buffer): Promise<Fila[]> => {
  const libro = new ExcelJS.Workbook()
  try {
    await libro.xlsx.load(buffer as unknown as ArrayBuffer)
  } catch {
    throw new ErrorGastos('El archivo no es un Excel válido (.xlsx). Descargue el Excel de corrección.')
  }

  const hoja = libro.getWorksheet('Correccion') ?? libro.worksheets[0]
  if (!hoja) throw new ErrorGastos('El archivo no tiene hojas')

  const encabezados = (hoja.getRow(1).values as ExcelJS.CellValue[]).map(textoCelda)
  if (!encabezados.includes('codigo')) {
    throw new ErrorGastos('Falta la columna codigo. Descargue el Excel de corrección nuevamente.')
  }
  // Las columnas que no vienen no se tocan (se pueden borrar del Excel)
  const columnas = new Set(COLUMNAS.filter(c => c.editable && encabezados.includes(c.titulo)).map(c => c.clave))

  const filas: Fila[] = []
  hoja.eachRow((row, numero) => {
    if (numero === 1) return
    const valores: Record<string, string> = {}
    encabezados.forEach((titulo, i) => {
      const columna = COLUMNAS.find(c => c.titulo === titulo)
      if (columna) valores[columna.clave] = textoCelda(row.getCell(i).value)
    })
    if (valores.codigo) filas.push({ numero, valores, columnas })
  })
  return filas
}

// '150000' | '150000.5' | '$ 150000' → centavos. Un texto con puntos de miles ('200.000') se
// rechaza: se leería como 200 y en una corrección de valores eso es grave
const leerValor = (valor: string, campo: string, errores: string[]): number | null => {
  const limpio = valor.replace(/[$\s]/g, '')
  if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) {
    errores.push(`${campo}: escriba el valor sin puntos de miles (ej: 200000)`)
    return null
  }
  const numero = Number(limpio.replace(',', '.'))
  if (!(numero > 0)) {
    errores.push(`${campo} debe ser un número mayor a cero`)
    return null
  }
  return aCentavos(numero)
}

const leerId = (valor: string, campo: string, errores: string[]): number | null => {
  if (!/^\d+$/.test(valor) || Number(valor) === 0) {
    errores.push(`${campo} debe ser un id de la hoja de apoyo`)
    return null
  }
  return Number(valor)
}


// =====================================
// PLAN DE CAMBIOS
// =====================================

type Plan = {
  fila: number
  gasto: SolicitudesGasto
  cambios: string[]
  campos: Partial<Record<keyof SolicitudesGasto, unknown>>
  // Solo en gastos pagados: movimientos de bolsa y diferencia en el total del lote
  movimientos: { bolsaId: number, movimiento: Movimiento }[]
  diferenciaLote: number
}

type Catalogos = { bolsas: Map<number, Bolsas>, tipos: Map<number, TiposGasto> }

const cargarCatalogos = async (transaction?: Transaction): Promise<Catalogos> => {
  const [bolsas, tipos] = await Promise.all([Bolsas.findAll({ transaction }), TiposGasto.findAll({ transaction })])
  return { bolsas: new Map(bolsas.map(b => [b.id, b])), tipos: new Map(tipos.map(t => [t.id, t])) }
}

// Arma el plan de una fila; acumula los errores de la fila
const planearFila = async (fila: Fila, gasto: SolicitudesGasto, catalogos: Catalogos, errores: string[]): Promise<Plan | null> => {
  const estado = await codigoEstadoGasto(gasto.estadoId)
  if (ESTADOS_CORREGIBLES.includes(estado)) return compararFila(fila, gasto, estado, catalogos, errores)

  // El Excel trae todos los gastos del filtro: un gasto ya facturado, legalizado, anulado... que
  // nadie tocó cuenta como "sin cambios"; solo es error si se pidió cambiarle algo
  const erroresFila: string[] = []
  const comoEsta = gasto.valorRealmentePagado === null ? ESTADOS_GASTO.SOLICITADO : ESTADOS_GASTO.PAGADO
  const plan = await compararFila(fila, gasto, comoEsta, catalogos, erroresFila)
  if (erroresFila.length || plan?.cambios.length) {
    errores.push(`${gasto.codigo} está en ${gasto.estado?.nombre ?? estado}: solo se corrigen gastos hasta Pagado`)
    return null
  }
  return plan
}

// Compara la fila con el gasto y arma lo que hay que cambiar; acumula los errores de la fila
const compararFila = async (fila: Fila, gasto: SolicitudesGasto, estado: string, catalogos: Catalogos, errores: string[]): Promise<Plan | null> => {
  const v = fila.valores
  const tiene = (campo: string) => fila.columnas.has(campo)
  const nombreEstado = gasto.estado?.nombre ?? estado

  const enLote = ESTADOS_EN_LOTE.includes(estado)
  const pagado = ESTADOS_PAGADOS.includes(estado)
  const porCaja = gasto.formaPago?.codigo === FORMA_PAGO_CAJA_MENOR

  const cambios: string[] = []
  const campos: Plan['campos'] = {}

  // ── Tipo de gasto ──
  const tipoActual = catalogos.tipos.get(gasto.tipoGastoId)!
  let tipoNuevo = tipoActual
  if (tiene('tipoGastoId') && v.tipoGastoId) {
    const id = leerId(v.tipoGastoId, 'tipoGastoId', errores)
    const tipo = id ? catalogos.tipos.get(id) : undefined
    if (id && !tipo?.activo) errores.push(`El tipo de gasto ${id} no existe o está inactivo`)
    else if (tipo) tipoNuevo = tipo
  }
  const cambiaTipo = tipoNuevo.id !== tipoActual.id

  // ── Bolsa ──
  // Hay gastos viejos sin bolsa
  const bolsaActual = catalogos.bolsas.get(gasto.bolsaId) ?? null
  let bolsaNueva = bolsaActual
  if (tiene('bolsaId') && v.bolsaId) {
    const id = leerId(v.bolsaId, 'bolsaId', errores)
    const bolsa = id ? catalogos.bolsas.get(id) : undefined
    if (id && !bolsa) errores.push(`La bolsa ${id} no existe`)
    else if (bolsa) bolsaNueva = bolsa
  }
  const cambiaBolsa = !!bolsaNueva && bolsaNueva.id !== bolsaActual?.id
  if (bolsaNueva && cambiaBolsa) {
    if (enLote) errores.push(`Está en el lote #${gasto.lotePagoId} por pagar: para cambiar la bolsa, Tesorería debe quitarlo del lote`)
    else if (gasto.anticipoId) errores.push('Salió de un anticipo: siempre se paga de la bolsa del anticipo')
    else if (estado === ESTADOS_GASTO.PAGADO_CAJA) errores.push('Ya se entregó el efectivo de la caja menor: la caja no se cambia')
    else {
      try {
        validarBolsaDelNuevoGasto(bolsaNueva, porCaja, false, gasto.reembolsable)
      } catch (error) {
        errores.push(error instanceof ErrorGastos ? error.message : 'La bolsa no sirve para este gasto')
      }
    }
  }

  // ── Valores ──
  const solicitadoAntes = aCentavos(gasto.valorSolicitadoPago)
  let solicitadoNuevo = solicitadoAntes
  if (tiene('valorSolicitado') && v.valorSolicitado) {
    solicitadoNuevo = leerValor(v.valorSolicitado, 'valorSolicitado', errores) ?? solicitadoAntes
  }

  const pagadoAntes = aCentavos(gasto.valorRealmentePagado)
  let pagadoNuevo = pagadoAntes
  if (tiene('valorPagado') && v.valorPagado) {
    const valor = leerValor(v.valorPagado, 'valorPagado', errores)
    if (valor !== null && !pagado) errores.push(`Aún no se ha pagado (${nombreEstado}): deje valorPagado vacío`)
    else if (valor !== null) pagadoNuevo = valor
  }

  if (enLote && solicitadoNuevo !== solicitadoAntes) {
    errores.push(`Está en el lote #${gasto.lotePagoId} por pagar: para cambiar el valor, Tesorería debe quitarlo del lote`)
  }

  // ── Identificación (placa, tránsito, matrícula) según el tipo ──
  const placa = tiene('placa') ? texto(v.placa)?.toUpperCase() ?? null : gasto.placa ?? null
  const transito = tiene('transito') ? texto(v.transito) : gasto.transito ?? null
  const matriculaInmobiliaria = tiene('matriculaInmobiliaria') ? texto(v.matriculaInmobiliaria) : gasto.matriculaInmobiliaria ?? null
  if ((placa?.length ?? 0) > 20) errores.push('placa supera 20 caracteres')
  if ((transito?.length ?? 0) > 100) errores.push('transito supera 100 caracteres')
  if ((matriculaInmobiliaria?.length ?? 0) > 50) errores.push('matriculaInmobiliaria supera 50 caracteres')

  let identificacion = { placa, transito, matriculaInmobiliaria }
  try {
    identificacion = identificacionPorTipo(tipoNuevo.codigo, identificacion)
  } catch (error) {
    errores.push(error instanceof ErrorGastos ? error.message : 'Revise placa, tránsito y matrícula')
  }

  if (errores.length) return null

  // ── Lo que cambia ──
  if (cambiaTipo) {
    cambios.push(`tipo ${tipoActual.nombre} → ${tipoNuevo.nombre}`)
    campos.tipoGastoId = tipoNuevo.id
    // La retención solo aplica a inmuebles: al pasar a inmueble toma la de por defecto
    // (base 0, porcentaje del parámetro); al dejar de serlo se borra
    const eraInmueble = tipoActual.codigo === TIPOS_GASTO.INMUEBLE
    const esInmueble = tipoNuevo.codigo === TIPOS_GASTO.INMUEBLE
    if (esInmueble && !eraInmueble) Object.assign(campos, await prepararRetencion({}))
    if (!esInmueble && eraInmueble) Object.assign(campos, RETENCION_VACIA)
  }
  const etiquetas = { placa: 'placa', transito: 'tránsito', matriculaInmobiliaria: 'matrícula' } as const
  for (const campo of ['placa', 'transito', 'matriculaInmobiliaria'] as const) {
    const antes = gasto[campo] ?? null
    if (identificacion[campo] !== antes) {
      cambios.push(`${etiquetas[campo]} ${antes ?? '(vacío)'} → ${identificacion[campo] ?? '(vacío)'}`)
      campos[campo] = identificacion[campo]
    }
  }
  if (bolsaNueva && cambiaBolsa) {
    cambios.push(`bolsa ${bolsaActual?.nombre ?? '(sin bolsa)'} → ${bolsaNueva.nombre}`)
    campos.bolsaId = bolsaNueva.id
  }
  if (solicitadoNuevo !== solicitadoAntes) {
    cambios.push(`valor solicitado ${moneda(solicitadoAntes)} → ${moneda(solicitadoNuevo)}`)
    campos.valorSolicitadoPago = String(solicitadoNuevo / 100)
  }

  const movimientos: Plan['movimientos'] = []
  const diferencia = pagadoNuevo - pagadoAntes
  if (diferencia !== 0) {
    cambios.push(`valor pagado ${moneda(pagadoAntes)} → ${moneda(pagadoNuevo)}`)
    campos.valorProgramado = String(pagadoNuevo / 100)
    campos.valorRealmentePagado = String(pagadoNuevo / 100)
  }

  // Dinero: solo en los ya pagados
  if (pagado && bolsaActual && bolsaNueva && cambiaBolsa) {
    movimientos.push({
      bolsaId: bolsaActual.id,
      movimiento: {
        tipo: TIPOS_MOVIMIENTO_BOLSA.REVERSO,
        valor: pagadoAntes / 100,
        solicitudGastoId: gasto.id,
        lotePagoId: gasto.lotePagoId ?? null,
        observacion: `Corrección masiva ${gasto.codigo}: el pago pasa a la bolsa ${bolsaNueva.nombre}`
      }
    }, {
      bolsaId: bolsaNueva.id,
      movimiento: {
        tipo: TIPOS_MOVIMIENTO_BOLSA.PAGO,
        valor: -pagadoNuevo / 100,
        solicitudGastoId: gasto.id,
        lotePagoId: gasto.lotePagoId ?? null,
        observacion: `Corrección masiva ${gasto.codigo}: el pago venía de la bolsa ${bolsaActual.nombre}`
      }
    })
  } else if (pagado && bolsaActual && diferencia !== 0) {
    movimientos.push({
      bolsaId: bolsaActual.id,
      movimiento: {
        tipo: TIPOS_MOVIMIENTO_BOLSA.AJUSTE,
        valor: -diferencia / 100,
        solicitudGastoId: gasto.id,
        lotePagoId: gasto.lotePagoId ?? null,
        observacion: `Corrección masiva del pago ${gasto.codigo}: ${moneda(pagadoAntes)} → ${moneda(pagadoNuevo)}`
      }
    })
  }

  return { fila: fila.numero, gasto, cambios, campos, movimientos, diferenciaLote: pagado ? diferencia : 0 }
}

// Lee el archivo y arma el plan de todas las filas. Dentro de la transacción de aplicar, los
// gastos y las bolsas se bloquean para que nadie los cambie mientras tanto
const planearArchivo = async (buffer: Buffer, transaction?: Transaction) => {
  const filas = await leerArchivo(buffer)
  if (filas.length === 0) throw new ErrorGastos('El archivo no tiene gastos')
  if (filas.length > MAXIMO_FILAS_CORRECCION) {
    throw new ErrorGastos(`El archivo tiene ${filas.length} gastos; el máximo es ${MAXIMO_FILAS_CORRECCION}`)
  }

  const codigos = [...new Set(filas.map(f => f.valores.codigo.toUpperCase()))]
  const gastos = await SolicitudesGasto.findAll({
    where: { codigo: { [Op.in]: codigos } },
    include: [
      { model: EstadosGasto, attributes: ['nombre'] },
      { model: FormasPago, attributes: ['codigo'] }
    ],
    transaction,
    ...(transaction ? { lock: { level: transaction.LOCK.UPDATE, of: SolicitudesGasto } } : {})
  })
  const porCodigo = new Map(gastos.map(g => [g.codigo, g]))
  const catalogos = await cargarCatalogos(transaction)

  const errores: ErrorFila[] = []
  const planes: Plan[] = []
  const vistos = new Map<string, number>()
  let sinCambios = 0

  for (const fila of filas) {
    const codigo = fila.valores.codigo.toUpperCase()
    const erroresFila: string[] = []
    const gasto = porCodigo.get(codigo)

    if (vistos.has(codigo)) erroresFila.push(`${codigo} está repetido (también en la fila ${vistos.get(codigo)})`)
    else if (!gasto) erroresFila.push(`No existe el gasto ${codigo}`)
    vistos.set(codigo, vistos.get(codigo) ?? fila.numero)

    let plan: Plan | null = null
    if (!erroresFila.length && gasto) {
      try {
        plan = await planearFila(fila, gasto, catalogos, erroresFila)
      } catch (error) {
        if (!(error instanceof ErrorGastos)) console.error(`Corrección masiva de gastos, fila ${fila.numero}:`, error)
        erroresFila.push(error instanceof ErrorGastos ? error.message : 'No se pudo validar esta fila')
      }
    }

    erroresFila.forEach(error => errores.push({ fila: fila.numero, error }))
    if (plan && plan.cambios.length) planes.push(plan)
    else if (plan) sinCambios++
  }

  // Saldo: lo que sale de cada bolsa (neto) no puede dejarla en negativo, salvo las sin saldo
  const netoPorBolsa = new Map<number, number>()
  for (const { bolsaId, movimiento } of planes.flatMap(p => p.movimientos)) {
    netoPorBolsa.set(bolsaId, (netoPorBolsa.get(bolsaId) ?? 0) + aCentavos(movimiento.valor))
  }
  for (const [bolsaId, neto] of netoPorBolsa) {
    const bolsa = catalogos.bolsas.get(bolsaId)!
    if (!bolsa.sinSaldo && neto < 0 && aCentavos(bolsa.saldoActual) + neto < 0) {
      errores.push({
        fila: 0,
        error: `Saldo insuficiente en la bolsa ${bolsa.nombre}: disponible ${moneda(aCentavos(bolsa.saldoActual))}, las correcciones descuentan ${moneda(-neto)}`
      })
    }
  }

  return { total: filas.length, sinCambios, errores, planes }
}

const resumen = (planes: Plan[]): CambioFila[] =>
  planes.map(p => ({ fila: p.fila, codigo: p.gasto.codigo, cambios: p.cambios }))


// =====================================
// OPERACIONES
// =====================================

// Revisa el archivo sin escribir nada: errores por fila y lo que cambiaría en cada gasto
export const validarCorreccion = async (buffer: Buffer) => {
  const { total, sinCambios, errores, planes } = await planearArchivo(buffer)
  return { total, sinCambios, errores, cambios: resumen(planes) }
}

// Aplica todas las correcciones en una sola transacción, solo si ninguna fila tiene error
export const aplicarCorreccion = (buffer: Buffer, motivo: string, usuarioId: number) =>
  db.transaction(async transaction => {
    const { total, sinCambios, errores, planes } = await planearArchivo(buffer, transaction)
    if (errores.length) return { ok: false as const, total, sinCambios, errores }
    if (!planes.length) throw new ErrorGastos('El archivo no tiene cambios: todos los gastos ya tienen esos datos')

    // Movimientos por bolsa en una sola llamada: el saldo se valida por el neto y lo que
    // entra (reversos) va antes de lo que sale
    const porBolsa = new Map<number, Movimiento[]>()
    for (const { bolsaId, movimiento } of planes.flatMap(p => p.movimientos)) {
      porBolsa.set(bolsaId, [...(porBolsa.get(bolsaId) ?? []), movimiento])
    }
    for (const [bolsaId, movimientos] of porBolsa) {
      await registrarMovimientos(bolsaId, movimientos.sort((a, b) => b.valor - a.valor), usuarioId, transaction)
    }

    // Total de cada lote pagado cuyo valor cambió
    const porLote = new Map<number, number>()
    for (const p of planes) {
      if (p.diferenciaLote && p.gasto.lotePagoId) porLote.set(p.gasto.lotePagoId, (porLote.get(p.gasto.lotePagoId) ?? 0) + p.diferenciaLote)
    }
    for (const [loteId, diferencia] of porLote) {
      const lote = await LotesPago.findByPk(loteId, { transaction, lock: transaction.LOCK.UPDATE })
      if (lote) await lote.update({ total: String((aCentavos(lote.total) + diferencia) / 100) }, { transaction })
    }

    for (const { gasto, campos, cambios } of planes) {
      await gasto.update({ ...campos, actualizadoPor: usuarioId }, { transaction })
      // Queda en el historial del gasto sin cambiar de estado
      await registrarTrazabilidad({
        solicitudGastoId: gasto.id,
        estadoAnteriorId: gasto.estadoId,
        estadoNuevoId: gasto.estadoId,
        usuarioId,
        observacion: `Corrección masiva: ${cambios.join(', ')}. Motivo: ${motivo}`
      }, transaction)
    }

    return { ok: true as const, total, sinCambios, cambios: resumen(planes) }
  })
