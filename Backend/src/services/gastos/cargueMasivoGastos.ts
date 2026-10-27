import ExcelJS from 'exceljs'
import { Op } from 'sequelize'
import { db } from '../../config/db'
import SolicitudTramites from '../../models/solicitudTramites'
import Operaciones from '../../models/operaciones'
import Bolsas from '../../models/gastos/bolsas'
import TiposGasto from '../../models/gastos/tiposGasto'
import FormasPago from '../../models/gastos/formasPago'
import Terceros from '../../models/gastos/terceros'
import { crearGastoEnTransaccion, validarGasto, type DatosGasto } from './solicitudesGasto'
import { ErrorGastos } from './errores'
import { TIPOS_GASTO } from './constantes'

// =====================================
// CARGUE MASIVO DE GASTOS (Excel)
// Una fila = un gasto. tramiteId es opcional (hay gastos sin trámite).
// Si cualquier fila tiene error no se carga ninguna: se corrige el archivo y se vuelve a subir.
// =====================================

export const MAXIMO_FILAS = 500

const COLUMNAS: { clave: string, titulo: string, ancho: number, nota: string }[] = [
  { clave: 'tramiteId', titulo: 'tramiteId', ancho: 11, nota: 'Número del trámite (opcional: vacío si el gasto no es de un trámite)' },
  { clave: 'operacionId', titulo: 'operacionId', ancho: 12, nota: 'Obligatorio solo si no hay trámite (hoja Operaciones). Con trámite se toma la del trámite' },
  { clave: 'bolsaId', titulo: 'bolsaId', ancho: 9, nota: 'Obligatorio (hoja Bolsas)' },
  { clave: 'tipoGastoId', titulo: 'tipoGastoId', ancho: 12, nota: 'Obligatorio (hoja TiposGasto)' },
  { clave: 'formaPagoId', titulo: 'formaPagoId', ancho: 12, nota: 'Obligatorio (hoja FormasPago)' },
  { clave: 'conceptoPago', titulo: 'conceptoPago', ancho: 34, nota: 'Obligatorio. Máximo 200 caracteres' },
  { clave: 'valorSolicitado', titulo: 'valorSolicitado', ancho: 15, nota: 'Obligatorio. Número sin puntos ni signo $ (ej: 150000)' },
  { clave: 'placa', titulo: 'placa', ancho: 10, nota: 'Obligatoria si el tipo es Vehículo (opcional en CTL, RUNT y Cámara de Comercio)' },
  { clave: 'transito', titulo: 'transito', ancho: 22, nota: 'Obligatorio si el tipo es Vehículo' },
  { clave: 'matriculaInmobiliaria', titulo: 'matriculaInmobiliaria', ancho: 20, nota: 'Obligatoria si el tipo es Inmueble (opcional en CTL y Cámara de Comercio)' },
  { clave: 'contrato', titulo: 'contrato', ancho: 16, nota: 'Opcional. Máximo 50 caracteres' },
  { clave: 'codigoBpr', titulo: 'codigoBPR/FTF', ancho: 16, nota: 'Opcional. Máximo 50 caracteres' },
  { clave: 'reembolsable', titulo: 'reembolsable', ancho: 12, nota: 'Si (se le cobra al cliente) o No (lo asume la bolsa). Vacío = Si' },
  { clave: 'beneficiarioIdentificacion', titulo: 'beneficiarioIdentificacion', ancho: 24, nota: 'Obligatorio (hoja Beneficiarios). Si ya existe, se usan sus datos registrados' },
  { clave: 'beneficiarioTipoIdentificacion', titulo: 'beneficiarioTipoIdentificacion', ancho: 16, nota: 'NIT, CC, CE o PAS (solo para beneficiarios nuevos; vacío = NIT)' },
  { clave: 'beneficiarioNombre', titulo: 'beneficiarioNombre', ancho: 30, nota: 'Obligatorio solo si el beneficiario es nuevo' },
  { clave: 'beneficiarioBanco', titulo: 'beneficiarioBanco', ancho: 18, nota: 'Opcional (beneficiarios nuevos)' },
  { clave: 'beneficiarioTipoCuenta', titulo: 'beneficiarioTipoCuenta', ancho: 16, nota: 'AHORROS o CORRIENTE (beneficiarios nuevos)' },
  { clave: 'beneficiarioNumeroCuenta', titulo: 'beneficiarioNumeroCuenta', ancho: 20, nota: 'Opcional (beneficiarios nuevos)' },
  { clave: 'observacion', titulo: 'observacion', ancho: 30, nota: 'Opcional' }
]

// Columnas que el archivo puede no traer: las de datos opcionales (pueden borrarlas del Excel)
// y las agregadas después (las plantillas descargadas antes no las tienen)
const COLUMNAS_NO_EXIGIDAS = [
  'contrato', 'codigoBpr', 'observacion', 'beneficiarioTipoIdentificacion', 'beneficiarioNombre',
  'beneficiarioBanco', 'beneficiarioTipoCuenta', 'beneficiarioNumeroCuenta'
]

export type ErrorFila = { fila: number, error: string }

type Fila = { numero: number, valores: Record<string, string> }


// =====================================
// PLANTILLA
// =====================================

// Si se indican trámites, la plantilla viene con una fila por trámite (número, operación,
// placa/matrícula y tipo sugerido) para completar solo los que tengan gasto
export const generarPlantilla = async (tramiteIds: number[], soloPropiosDe: number[] | null) => {
  const [bolsas, tipos, formas, operaciones, terceros, tramites] = await Promise.all([
    Bolsas.findAll({ where: { activo: true }, attributes: ['id', 'nombre', 'lineaNegocio'], order: [['nombre', 'ASC']] }),
    TiposGasto.findAll({ where: { activo: true }, attributes: ['id', 'codigo', 'nombre'], order: [['id', 'ASC']] }),
    FormasPago.findAll({ where: { activo: true }, attributes: ['id', 'nombre'], order: [['nombre', 'ASC']] }),
    Operaciones.findAll({ attributes: ['id', 'nombreOperacion'], order: [['nombreOperacion', 'ASC']] }),
    // Para buscar la identificación del beneficiario (sin la cuenta bancaria)
    Terceros.findAll({ where: { activo: true }, attributes: ['identificacion', 'tipoIdentificacion', 'nombre', 'banco'], order: [['nombre', 'ASC']] }),
    tramiteIds.length
      ? SolicitudTramites.findAll({
        where: {
          id: { [Op.in]: tramiteIds },
          // Gestión de activos: solo sus trámites
          ...(soloPropiosDe && { usuarioId: soloPropiosDe })
        },
        attributes: ['id', 'operacionesId', 'placa', 'matriculaInmobiliaria'],
        order: [['id', 'ASC']]
      })
      : Promise.resolve([])
  ])

  const libro = new ExcelJS.Workbook()
  libro.creator = 'Nodex'

  // Hoja principal
  const hoja = libro.addWorksheet('Gastos', { views: [{ state: 'frozen', ySplit: 1 }] })
  hoja.columns = COLUMNAS.map(c => ({ header: c.titulo, key: c.clave, width: c.ancho }))
  COLUMNAS.forEach((c, i) => { hoja.getRow(1).getCell(i + 1).note = c.nota })

  const idTipo = (codigo: string) => tipos.find(t => t.codigo === codigo)?.id ?? ''
  for (const t of tramites) {
    hoja.addRow({
      tramiteId: t.id,
      operacionId: t.operacionesId,
      tipoGastoId: t.placa ? idTipo(TIPOS_GASTO.VEHICULO) : t.matriculaInmobiliaria ? idTipo(TIPOS_GASTO.INMUEBLE) : '',
      placa: t.placa ?? '',
      matriculaInmobiliaria: t.matriculaInmobiliaria ?? ''
    })
  }

  const encabezado = hoja.getRow(1)
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0EA5E9' } }

  // Hojas de apoyo con los ids válidos
  const apoyo = (nombre: string, columnas: { header: string, key: string, width: number }[], filas: object[]) => {
    const h = libro.addWorksheet(nombre)
    h.columns = columnas
    h.addRows(filas)
    h.getRow(1).font = { bold: true }
    return h
  }

  apoyo('Bolsas', [{ header: 'id', key: 'id', width: 6 }, { header: 'nombre', key: 'nombre', width: 24 }, { header: 'lineaNegocio', key: 'lineaNegocio', width: 24 }],
    bolsas.map(b => ({ id: b.id, nombre: b.nombre, lineaNegocio: b.lineaNegocio })))
  apoyo('TiposGasto', [{ header: 'id', key: 'id', width: 6 }, { header: 'nombre', key: 'nombre', width: 20 }],
    tipos.map(t => ({ id: t.id, nombre: t.nombre })))
  apoyo('FormasPago', [{ header: 'id', key: 'id', width: 6 }, { header: 'nombre', key: 'nombre', width: 24 }],
    formas.map(f => ({ id: f.id, nombre: f.nombre })))
  apoyo('Operaciones', [{ header: 'id', key: 'id', width: 6 }, { header: 'nombre', key: 'nombre', width: 40 }],
    operaciones.map(o => ({ id: o.id, nombre: o.nombreOperacion })))
  // Puede ser larga: encabezado fijo y filtro para buscar por nombre o identificación
  const hojaBeneficiarios = apoyo('Beneficiarios', [
    { header: 'identificacion', key: 'identificacion', width: 18 },
    { header: 'tipoIdentificacion', key: 'tipo', width: 16 },
    { header: 'nombre', key: 'nombre', width: 40 },
    { header: 'banco', key: 'banco', width: 22 }
  ], terceros.map(t => ({ identificacion: t.identificacion, tipo: t.tipoIdentificacion, nombre: t.nombre, banco: t.banco })))
  hojaBeneficiarios.views = [{ state: 'frozen', ySplit: 1 }]
  hojaBeneficiarios.autoFilter = { from: 'A1', to: 'D1' }

  const instrucciones = libro.addWorksheet('Instrucciones')
  instrucciones.columns = [{ header: 'Columna', key: 'columna', width: 30 }, { header: 'Cómo llenarla', key: 'nota', width: 90 }]
  instrucciones.addRows(COLUMNAS.map(c => ({ columna: c.titulo, nota: c.nota })))
  instrucciones.addRow({})
  instrucciones.addRow({ columna: 'Importante', nota: 'Una fila por gasto. Si alguna fila tiene error no se carga ninguna: corrija el archivo y vuelva a subirlo.' })
  instrucciones.addRow({ columna: '', nota: `Máximo ${MAXIMO_FILAS} gastos por archivo. Borre las filas de trámites que no tengan gasto.` })
  instrucciones.getRow(1).font = { bold: true }

  return libro.xlsx.writeBuffer()
}


// =====================================
// LECTURA Y VALIDACIÓN
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
    throw new ErrorGastos('El archivo no es un Excel válido (.xlsx). Use la plantilla.')
  }

  const hoja = libro.getWorksheet('Gastos') ?? libro.worksheets[0]
  if (!hoja) throw new ErrorGastos('El archivo no tiene hojas')

  const encabezados = (hoja.getRow(1).values as ExcelJS.CellValue[]).map(textoCelda)
  const faltantes = COLUMNAS
    .filter(c => !COLUMNAS_NO_EXIGIDAS.includes(c.clave) && !encabezados.includes(c.titulo))
    .map(c => c.titulo)
  if (faltantes.length) {
    throw new ErrorGastos(`Faltan columnas de la plantilla: ${faltantes.join(', ')}. Descargue la plantilla nuevamente.`)
  }

  const filas: Fila[] = []
  hoja.eachRow((row, numero) => {
    if (numero === 1) return
    // Los valores quedan por clave (el título puede ser distinto, ej. codigoBPR/FTF) y todas
    // las columnas con texto, aunque el archivo no traiga las no exigidas
    const valores: Record<string, string> = Object.fromEntries(COLUMNAS.map(c => [c.clave, '']))
    encabezados.forEach((titulo, i) => {
      const columna = COLUMNAS.find(c => c.titulo === titulo)
      if (columna) valores[columna.clave] = textoCelda(row.getCell(i).value)
    })
    // Filas en blanco (o solo con datos prellenados del trámite) no se cargan
    const conDatosDeGasto = ['conceptoPago', 'valorSolicitado', 'beneficiarioIdentificacion', 'bolsaId', 'formaPagoId']
      .some(c => valores[c])
    if (conDatosDeGasto) filas.push({ numero, valores })
  })

  return filas
}

const entero = (valor: string) => (valor === '' ? null : /^\d+$/.test(valor) ? Number(valor) : NaN)

// Convierte una fila en los datos del gasto; acumula los errores de formato
const convertirFila = (fila: Fila, operacionDeTramite: Map<number, number | null>, errores: string[]): DatosGasto | null => {
  const v = fila.valores
  const largo = (campo: string, maximo: number) => {
    if (v[campo] && v[campo].length > maximo) errores.push(`${campo} supera ${maximo} caracteres`)
  }

  const ids: Record<string, number | null> = {}
  for (const campo of ['tramiteId', 'operacionId', 'bolsaId', 'tipoGastoId', 'formaPagoId']) {
    ids[campo] = entero(v[campo])
    if (Number.isNaN(ids[campo])) errores.push(`${campo} debe ser un número entero`)
    // 0 no es un id: antes un tramiteId 0 pasaba como "sin trámite" y fallaba al guardar
    else if (ids[campo] === 0) {
      errores.push(campo === 'tramiteId' || campo === 'operacionId'
        ? `${campo} no puede ser 0: déjelo vacío si no aplica`
        : `${campo} no puede ser 0`)
    }
  }

  for (const campo of ['bolsaId', 'tipoGastoId', 'formaPagoId', 'conceptoPago', 'valorSolicitado', 'beneficiarioIdentificacion']) {
    if (!v[campo]) errores.push(`${campo} es obligatorio`)
  }

  const valor = Number(v.valorSolicitado.replace(/[$\s]/g, '').replace(',', '.'))
  if (v.valorSolicitado && !(valor > 0)) errores.push('valorSolicitado debe ser un número mayor a cero (sin puntos ni $)')

  const reembolsable = v.reembolsable.toLowerCase()
  if (reembolsable && !['si', 'sí', 'no'].includes(reembolsable)) errores.push('reembolsable debe ser Si o No')

  const tipoIdentificacion = v.beneficiarioTipoIdentificacion.toUpperCase()
  if (tipoIdentificacion && !['NIT', 'CC', 'CE', 'PAS'].includes(tipoIdentificacion)) errores.push('beneficiarioTipoIdentificacion debe ser NIT, CC, CE o PAS')

  const tipoCuenta = v.beneficiarioTipoCuenta.toUpperCase()
  if (tipoCuenta && !['AHORROS', 'CORRIENTE'].includes(tipoCuenta)) errores.push('beneficiarioTipoCuenta debe ser AHORROS o CORRIENTE')

  largo('conceptoPago', 200); largo('placa', 20); largo('transito', 100); largo('matriculaInmobiliaria', 50)
  largo('contrato', 50)
  if (v.codigoBpr.length > 50) errores.push('codigoBPR/FTF supera 50 caracteres')
  largo('beneficiarioIdentificacion', 30); largo('beneficiarioNombre', 200); largo('beneficiarioBanco', 100)
  largo('beneficiarioNumeroCuenta', 30); largo('observacion', 2000)

  // Operación: la del trámite si lo hay; si no, la de la columna
  let operacionId = ids.operacionId
  if (ids.tramiteId) {
    if (Number.isNaN(ids.tramiteId)) {
      // ya se reportó que tramiteId no es un número
    } else if (!operacionDeTramite.has(ids.tramiteId)) {
      errores.push(`El trámite ${ids.tramiteId} no existe o no es suyo`)
    } else {
      operacionId = operacionDeTramite.get(ids.tramiteId) ?? operacionId
      if (!operacionId) errores.push(`El trámite ${ids.tramiteId} no tiene operación: indique operacionId`)
    }
  } else if (!operacionId) {
    errores.push('operacionId es obligatorio cuando el gasto no tiene trámite')
  }

  if (errores.length) return null

  return {
    solicitudTramiteId: ids.tramiteId,
    operacionId: operacionId!,
    bolsaId: ids.bolsaId!,
    tipoGastoId: ids.tipoGastoId!,
    formaPagoId: ids.formaPagoId!,
    conceptoPago: v.conceptoPago,
    valorSolicitado: valor,
    placa: v.placa || null,
    transito: v.transito || null,
    matriculaInmobiliaria: v.matriculaInmobiliaria || null,
    contrato: v.contrato || null,
    codigoBpr: v.codigoBpr || null,
    // Vacío = Sí (por defecto los gastos son reembolsables)
    reembolsable: reembolsable !== 'no',
    observacion: v.observacion || null,
    beneficiarioId: null,
    beneficiario: {
      identificacion: v.beneficiarioIdentificacion,
      tipoIdentificacion: tipoIdentificacion || 'NIT',
      nombre: v.beneficiarioNombre,
      banco: v.beneficiarioBanco,
      tipoCuenta: tipoCuenta,
      numeroCuenta: v.beneficiarioNumeroCuenta
    }
  }
}

// Lee y valida todo el archivo sin escribir nada en la base de datos
const validarArchivo = async (buffer: Buffer, soloPropiosDe: number[] | null) => {
  const filas = await leerArchivo(buffer)

  if (filas.length === 0) throw new ErrorGastos('El archivo no tiene gastos para cargar')
  if (filas.length > MAXIMO_FILAS) throw new ErrorGastos(`El archivo tiene ${filas.length} gastos; el máximo es ${MAXIMO_FILAS}`)

  // Trámites referenciados (y su operación), respetando "solo sus trámites"
  const ids = [...new Set(filas.map(f => entero(f.valores.tramiteId)).filter((id): id is number => !!id && !Number.isNaN(id)))]
  const tramites = ids.length
    ? await SolicitudTramites.findAll({
      where: { id: { [Op.in]: ids }, ...(soloPropiosDe && { usuarioId: soloPropiosDe }) },
      attributes: ['id', 'operacionesId']
    })
    : []
  const operacionDeTramite = new Map(tramites.map(t => [t.id, t.operacionesId ?? null]))

  const errores: ErrorFila[] = []
  const gastos: { fila: number, datos: DatosGasto }[] = []

  for (const fila of filas) {
    const erroresFila: string[] = []
    const datos = convertirFila(fila, operacionDeTramite, erroresFila)

    if (datos) {
      // Mismas reglas que al crear un gasto uno a uno (tipo, bolsa, beneficiario, ...)
      try {
        await validarGasto(datos)
      } catch (error) {
        // Un error inesperado también se reporta en su fila (antes salía solo "Hubo un error")
        if (!(error instanceof ErrorGastos)) console.error(`Cargue masivo de gastos, fila ${fila.numero}:`, error)
        erroresFila.push(error instanceof ErrorGastos ? error.message : 'No se pudo validar: revise el trámite, la operación, la bolsa, el tipo, la forma de pago y el beneficiario')
      }
    }

    if (erroresFila.length) erroresFila.forEach(error => errores.push({ fila: fila.numero, error }))
    else gastos.push({ fila: fila.numero, datos: datos! })
  }

  return { total: filas.length, errores, gastos }
}

export const validarCargue = async (buffer: Buffer, soloPropiosDe: number[] | null) => {
  const { total, errores } = await validarArchivo(buffer, soloPropiosDe)
  return { total, errores }
}

// Carga todos los gastos en una sola transacción, solo si ninguna fila tiene error
export const cargarGastos = async (buffer: Buffer, usuarioId: number, soloPropiosDe: number[] | null) => {
  const { total, errores, gastos } = await validarArchivo(buffer, soloPropiosDe)

  if (errores.length) return { ok: false as const, total, errores }

  const creados = await db.transaction(async transaction => {
    const creados: { id: number, codigo: string }[] = []
    for (const { fila, datos } of gastos) {
      try {
        const gasto = await crearGastoEnTransaccion(datos, usuarioId, transaction)
        creados.push({ id: gasto.id, codigo: gasto.codigo })
      } catch (error) {
        // No se crea ninguno; se dice en qué fila falló en lugar de "Hubo un error"
        if (!(error instanceof ErrorGastos)) console.error(`Cargue masivo de gastos, fila ${fila}:`, error)
        throw new ErrorGastos(`Fila ${fila}: ${error instanceof ErrorGastos ? error.message : 'no se pudo crear el gasto, revise los datos de esa fila'}. No se cargó ningún gasto.`)
      }
    }
    return creados
  })

  return { ok: true as const, total, ids: creados.map(g => g.id), codigos: creados.map(g => g.codigo) }
}
