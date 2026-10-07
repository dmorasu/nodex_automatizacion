import ExcelJS from 'exceljs'
import XLSX from 'xlsx'
import { Op, QueryTypes } from 'sequelize'
import { db } from '../config/db'
import SolicitudTramites from '../models/solicitudTramites'
import Clientes from '../models/clientes'
import Operaciones from '../models/operaciones'
import Entidad from '../models/entidad'
import Tramites from '../models/tramite'
import Bolsas from '../models/gastos/bolsas'
import TiposGasto from '../models/gastos/tiposGasto'
import FormasPago from '../models/gastos/formasPago'
import Terceros from '../models/gastos/terceros'
import { crearGastoEnTransaccion, validarGasto, type DatosGasto } from './gastos/solicitudesGasto'
import { ErrorGastos } from './gastos/errores'
import { TIPOS_BOLSA } from './gastos/constantes'
import { ubicarEnSegundoPlano } from './mensajeria/ubicacion'

// =====================================
// CARGUE MASIVO DE TRÁMITES EN PANTALLA
// El usuario arma las filas en pantalla (a mano, pegando desde Excel o importando el archivo),
// las valida y las guarda. Cada fila es un trámite y, si se marca, su gasto. Se guarda todo o
// nada en una transacción. Los catálogos se eligen por nombre; aquí llegan ya como ids
// (el cliente puede venir como identificación o nombre: se resuelve aquí).
// =====================================

export const MAXIMO_FILAS = 300

export type GastoDeFila = {
  tipoGastoId?: number | null
  bolsaId?: number | null
  formaPagoId?: number | null
  conceptoPago?: string | null
  valorSolicitado?: number | string | null
  transito?: string | null
  reembolsable?: boolean | null
  beneficiarioId?: number | null
  beneficiario?: { tipoIdentificacion?: string | null, identificacion?: string | null, nombre?: string | null } | null
  observacion?: string | null
}

export type FilaCargue = {
  clienteId?: number | null
  // Si no hay clienteId: identificación o nombre exacto del cliente (pegado o importado)
  clienteTexto?: string | null
  municipioId?: number | null
  operacionId?: number | null
  entidadId?: number | null
  tramiteId?: number | null
  detalle?: string | null
  direccion?: string | null
  placa?: string | null
  matricula?: string | null
  fechaEntregaResultado?: string | null
  documentosAportados?: string | null
  gasto?: GastoDeFila | null
}

export type ResultadoFila = {
  fila: number
  errores: string[]
  avisos: string[]
  cliente: { id: number, nombre: string, identificacion: string | null } | null
}

const texto = (valor: unknown) => String(valor ?? '').trim()
const normalizar = (valor: unknown) => texto(valor).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').toUpperCase()
const fechaValida = (valor: string) => /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(new Date(`${valor}T12:00:00`).getTime())

// ── Catálogos para la pantalla ──

export const catalogosCargue = async (conGastos: boolean) => {
  const [operaciones, entidades, tramites, municipios, gastos] = await Promise.all([
    Operaciones.findAll({ attributes: ['id', 'nombreOperacion'], order: [['nombreOperacion', 'ASC']] }),
    Entidad.findAll({ attributes: ['id', 'nombreEntidad'], order: [['nombreEntidad', 'ASC']] }),
    Tramites.findAll({ attributes: ['id', 'nombreTramite'], order: [['nombreTramite', 'ASC']] }),
    // Cada municipio una sola vez (la tabla tiene copias; se toma la de menor id, como el buscador)
    db.query<{ id: number, nombreMunicipio: string, departamento: string | null }>(`
      SELECT DISTINCT ON (UPPER(TRIM("nombreMunicipio")), UPPER(TRIM(departamento))) id, TRIM("nombreMunicipio") AS "nombreMunicipio", TRIM(departamento) AS departamento
      FROM "Municipios"
      ORDER BY UPPER(TRIM("nombreMunicipio")), UPPER(TRIM(departamento)), id
    `, { type: QueryTypes.SELECT }),
    conGastos
      ? Promise.all([
        Bolsas.findAll({ where: { activo: true, tipo: TIPOS_BOLSA.GENERAL }, attributes: ['id', 'nombre'], order: [['nombre', 'ASC']] }),
        TiposGasto.findAll({ where: { activo: true }, attributes: ['id', 'codigo', 'nombre'], order: [['id', 'ASC']] }),
        FormasPago.findAll({ where: { activo: true }, attributes: ['id', 'nombre'], order: [['nombre', 'ASC']] })
      ])
      : Promise.resolve(null)
  ])

  return {
    operaciones: operaciones.map(o => ({ id: o.id, nombre: o.nombreOperacion })),
    entidades: entidades.map(e => ({ id: e.id, nombre: e.nombreEntidad })),
    tramites: tramites.map(t => ({ id: t.id, nombre: t.nombreTramite })),
    municipios: municipios.map(m => ({ id: Number(m.id), nombre: m.nombreMunicipio, departamento: m.departamento })),
    gastos: gastos ? {
      bolsas: gastos[0].map(b => ({ id: b.id, nombre: b.nombre })),
      tiposGasto: gastos[1].map(t => ({ id: t.id, codigo: t.codigo, nombre: t.nombre })),
      formasPago: gastos[2].map(f => ({ id: f.id, nombre: f.nombre }))
    } : null
  }
}

// Clientes por nombre o identificación (selector de la pantalla)
export const buscarClientes = async (busqueda: string) => {
  const t = texto(busqueda)
  if (t.length < 2) return []
  const clientes = await Clientes.findAll({
    where: { [Op.or]: [{ nombreCliente: { [Op.iLike]: `%${t}%` } }, { identificacionCliente: { [Op.iLike]: `${t}%` } }] },
    attributes: ['id', 'nombreCliente', 'identificacionCliente'],
    order: [[db.literal(`"nombreCliente" ILIKE ${db.escape(`${t}%`)}`), 'DESC'], ['nombreCliente', 'ASC']],
    limit: 20
  })
  return clientes.map(c => ({ id: c.id, nombre: c.nombreCliente, identificacion: c.identificacionCliente ?? null }))
}

// ── Validación ──

// Los clientes que llegan como texto se buscan por identificación exacta o nombre exacto
const resolverClientes = async (filas: FilaCargue[]) => {
  const ids = [...new Set(filas.map(f => Number(f.clienteId)).filter(Boolean))]
  const textos = [...new Set(filas.filter(f => !f.clienteId && texto(f.clienteTexto)).map(f => texto(f.clienteTexto)))]

  const [porId, porTexto] = await Promise.all([
    ids.length ? Clientes.findAll({ where: { id: ids }, attributes: ['id', 'nombreCliente', 'identificacionCliente'] }) : [],
    textos.length
      ? Clientes.findAll({
        where: { [Op.or]: [{ identificacionCliente: textos }, { nombreCliente: { [Op.iLike]: { [Op.any]: textos } } }] },
        attributes: ['id', 'nombreCliente', 'identificacionCliente']
      })
      : []
  ])

  return (fila: FilaCargue) => {
    if (fila.clienteId) return { encontrados: porId.filter(c => c.id === Number(fila.clienteId)) }
    const t = texto(fila.clienteTexto)
    if (!t) return { encontrados: [] }
    const exactos = porTexto.filter(c => texto(c.identificacionCliente) === t)
    return { encontrados: exactos.length ? exactos : porTexto.filter(c => normalizar(c.nombreCliente) === normalizar(t)) }
  }
}

const esPlaca = (fila: FilaCargue) => Boolean(texto(fila.placa))

// Datos del gasto de la fila en el formato del módulo de gastos
const datosGasto = (fila: FilaCargue, operacionId: number, solicitudTramiteId: number | null): DatosGasto => {
  const g = fila.gasto!
  return {
    operacionId,
    bolsaId: Number(g.bolsaId),
    solicitudTramiteId,
    tipoGastoId: Number(g.tipoGastoId),
    formaPagoId: Number(g.formaPagoId),
    conceptoPago: texto(g.conceptoPago),
    valorSolicitado: Number(String(g.valorSolicitado ?? '').replace(/[^\d.]/g, '')),
    placa: texto(fila.placa) || null,
    matriculaInmobiliaria: texto(fila.matricula) || null,
    transito: texto(g.transito) || null,
    reembolsable: g.reembolsable ?? true,
    observacion: texto(g.observacion) || null,
    beneficiarioId: g.beneficiarioId ? Number(g.beneficiarioId) : null,
    beneficiario: g.beneficiarioId ? null : {
      tipoIdentificacion: texto(g.beneficiario?.tipoIdentificacion) || 'NIT',
      identificacion: texto(g.beneficiario?.identificacion),
      nombre: texto(g.beneficiario?.nombre)
    }
  }
}

// Revisa todas las filas sin guardar nada. Errores = no se puede guardar; avisos = se puede,
// pero conviene revisarlo (ej: ya hay un trámite abierto igual)
export const validarCargue = async (filas: FilaCargue[]) => {
  if (!filas.length) throw new ErrorGastos('Agregue al menos una fila')
  if (filas.length > MAXIMO_FILAS) throw new ErrorGastos(`Máximo ${MAXIMO_FILAS} trámites por cargue`)

  const [clientes, catalogos, abiertos] = await Promise.all([
    resolverClientes(filas),
    Promise.all([
      Operaciones.findAll({ attributes: ['id'] }), Entidad.findAll({ attributes: ['id'] }),
      Tramites.findAll({ attributes: ['id', 'nombreTramite'] }),
      db.query<{ id: number }>('SELECT id FROM "Municipios"', { type: QueryTypes.SELECT })
    ]),
    // Trámites abiertos (ni Finalizado ni Desistido) con la misma placa o matrícula
    (async () => {
      const placas = [...new Set(filas.map(f => normalizar(f.placa)).filter(Boolean))]
      const matriculas = [...new Set(filas.map(f => normalizar(f.matricula)).filter(Boolean))]
      if (!placas.length && !matriculas.length) return []
      return db.query<{ id: number, placa: string | null, matricula: string | null, tramiteId: number | null }>(`
        SELECT t.id, UPPER(TRIM(t.placa)) AS placa, UPPER(TRIM(t."matriculaInmobiliaria")) AS matricula, t."tramiteId"
        FROM "SolicitudTramites" t
        LEFT JOIN "Estados" e ON e.id = t."estadoActualTramite"
        WHERE (UPPER(TRIM(t.placa)) IN (:placas) OR UPPER(TRIM(t."matriculaInmobiliaria")) IN (:matriculas))
          AND COALESCE(e."nombreEstado", '') NOT IN ('Finalizado', 'Desistido')
      `, { replacements: { placas: placas.length ? placas : [''], matriculas: matriculas.length ? matriculas : [''] }, type: QueryTypes.SELECT })
    })()
  ])
  const [operaciones, entidades, tramites, municipios] = catalogos
  const existe = (lista: { id?: number }[], id: unknown) => lista.some(x => Number(x.id) === Number(id))
  const nombreTramite = (id: unknown) => tramites.find(t => t.id === Number(id))?.nombreTramite ?? 'este tipo'

  const resultados: ResultadoFila[] = []
  for (const [i, fila] of filas.entries()) {
    const errores: string[] = []
    const avisos: string[] = []

    const { encontrados } = clientes(fila)
    if (!fila.clienteId && !texto(fila.clienteTexto)) errores.push('Falta el cliente')
    else if (!encontrados.length) errores.push(`No existe el cliente "${texto(fila.clienteTexto) || fila.clienteId}" (búsquelo por nombre o créelo primero)`)
    else if (encontrados.length > 1) errores.push(`Hay ${encontrados.length} clientes llamados "${texto(fila.clienteTexto)}": elíjalo en la lista`)

    if (!existe(municipios, fila.municipioId)) errores.push('Falta el municipio')
    if (!existe(operaciones, fila.operacionId)) errores.push('Falta la operación')
    if (!existe(entidades, fila.entidadId)) errores.push('Falta la entidad')
    if (!existe(tramites, fila.tramiteId)) errores.push('Falta el tipo de trámite')
    if (!texto(fila.detalle)) errores.push('Falta el detalle')
    else if (texto(fila.detalle).length > 200) errores.push('El detalle supera 200 caracteres')
    if (!texto(fila.direccion)) errores.push('Falta la dirección')
    if (!fechaValida(texto(fila.fechaEntregaResultado))) errores.push('Falta la fecha de entrega del resultado')
    if (!texto(fila.placa) && !texto(fila.matricula)) errores.push('Falta la placa o la matrícula inmobiliaria')

    // Repetidos: en el mismo cargue y contra trámites abiertos del mismo tipo
    const clave = normalizar(fila.placa) || normalizar(fila.matricula)
    if (clave) {
      const repetida = filas.findIndex((otra, j) => j !== i && (normalizar(otra.placa) || normalizar(otra.matricula)) === clave && Number(otra.tramiteId) === Number(fila.tramiteId))
      if (repetida !== -1) avisos.push(`La fila ${repetida + 1} tiene la misma ${esPlaca(fila) ? 'placa' : 'matrícula'} y el mismo tipo de trámite`)
      const abierto = abiertos.find(t => (esPlaca(fila) ? t.placa : t.matricula) === clave && Number(t.tramiteId) === Number(fila.tramiteId))
      if (abierto) avisos.push(`Ya existe el trámite #${abierto.id} abierto de ${nombreTramite(fila.tramiteId)} para esta ${esPlaca(fila) ? 'placa' : 'matrícula'}`)
    }

    // Gasto: mismas reglas que al crearlo uno por uno (sin guardar)
    if (fila.gasto) {
      try {
        if (!fila.gasto.bolsaId || !fila.gasto.tipoGastoId || !fila.gasto.formaPagoId) throw new ErrorGastos('el gasto necesita bolsa, tipo de gasto y forma de pago')
        await validarGasto(datosGasto(fila, Number(fila.operacionId) || 0, null))
      } catch (error) {
        errores.push(`Gasto: ${error instanceof ErrorGastos ? error.message : 'no se pudo validar'}`)
      }
    }

    const cliente = encontrados.length === 1 ? encontrados[0] : null
    resultados.push({
      fila: i + 1,
      errores,
      avisos,
      cliente: cliente ? { id: cliente.id, nombre: cliente.nombreCliente, identificacion: cliente.identificacionCliente ?? null } : null
    })
  }

  return {
    filas: resultados,
    conErrores: resultados.filter(r => r.errores.length).length,
    conAvisos: resultados.filter(r => r.avisos.length).length,
    conGasto: filas.filter(f => f.gasto).length
  }
}

// ── Guardar ──

// Crea todos los trámites (y sus gastos) o ninguno. Antes valida: con un solo error no guarda.
export const crearCargue = async (filas: FilaCargue[], usuarioId: number) => {
  const validacion = await validarCargue(filas)
  if (validacion.conErrores) {
    return { ok: false as const, validacion }
  }

  const creados = await db.transaction(async transaction => {
    const lista: { fila: number, tramiteId: number, gastoId: number | null, gastoCodigo: string | null }[] = []
    for (const [i, fila] of filas.entries()) {
      const cliente = validacion.filas[i].cliente!
      const tramite = await SolicitudTramites.create({
        clienteId: cliente.id,
        municipiosId: Number(fila.municipioId),
        operacionesId: Number(fila.operacionId),
        entidadId: Number(fila.entidadId),
        tramiteId: Number(fila.tramiteId),
        usuarioId,
        detalleSolicitud: texto(fila.detalle),
        direccionTramite: texto(fila.direccion),
        placa: texto(fila.placa).toUpperCase() || null,
        matriculaInmobiliaria: texto(fila.matricula) || null,
        documentosAportados: texto(fila.documentosAportados) || 'No',
        // Medianoche de Colombia, como el formulario
        fechaEntregaResultado: new Date(`${texto(fila.fechaEntregaResultado)}T00:00:00-05:00`)
      }, { transaction })

      let gasto = null
      if (fila.gasto) gasto = await crearGastoEnTransaccion(datosGasto(fila, tramite.operacionesId, tramite.id), usuarioId, transaction)
      lista.push({ fila: i + 1, tramiteId: tramite.id, gastoId: gasto?.id ?? null, gastoCodigo: gasto?.codigo ?? null })
    }
    return lista
  })

  // Después de guardar: ubicar las direcciones para las rutas de mensajeros (en segundo plano)
  creados.forEach(c => ubicarEnSegundoPlano(c.tramiteId))
  return { ok: true as const, creados }
}

// ── Plantilla e importación de Excel ──

const COLUMNAS_EXCEL = [
  { titulo: 'Placa', ancho: 10, nota: 'Placa del vehículo (o deje vacía y use Matrícula)' },
  { titulo: 'Matrícula', ancho: 14, nota: 'Matrícula inmobiliaria (si no es vehículo)' },
  { titulo: 'Detalle', ancho: 40, nota: 'Obligatorio. Máximo 200 caracteres' },
  { titulo: 'Dirección', ancho: 34, nota: 'Obligatoria' },
  { titulo: 'Municipio', ancho: 22, nota: 'Nombre del municipio (si se repite en otro departamento: "Municipio - Departamento")' },
  { titulo: 'Tipo de trámite', ancho: 26, nota: 'Elija de la lista' },
  { titulo: 'Cliente', ancho: 26, nota: 'Identificación o nombre exacto del cliente' },
  { titulo: 'Operación', ancho: 22, nota: 'Elija de la lista' },
  { titulo: 'Entidad', ancho: 22, nota: 'Elija de la lista' },
  { titulo: 'Fecha entrega', ancho: 13, nota: 'Fecha de entrega del resultado (dd/mm/aaaa)' },
  { titulo: 'Documentos aportados', ancho: 12, nota: 'Si o No' },
  { titulo: 'Gasto: concepto', ancho: 26, nota: 'Opcional: si la fila tiene gasto, el concepto del pago' },
  { titulo: 'Gasto: valor', ancho: 14, nota: 'Valor del gasto, sin puntos ni $' },
  { titulo: 'Gasto: beneficiario', ancho: 20, nota: 'Identificación del beneficiario del pago' },
  { titulo: 'Gasto: tránsito', ancho: 20, nota: 'Solo vehículos: tránsito donde se paga' }
] as const

// Plantilla con listas desplegables (por nombre, sin ids). Se importa en la pantalla, donde se
// revisa y completa antes de guardar
export const plantillaExcel = async () => {
  const catalogos = await catalogosCargue(false)
  const libro = new ExcelJS.Workbook()
  const hoja = libro.addWorksheet('Trámites')
  const listas = libro.addWorksheet('Listas', { state: 'veryHidden' })

  hoja.columns = COLUMNAS_EXCEL.map(c => ({ header: c.titulo, width: c.ancho }))
  hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  hoja.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } }
  COLUMNAS_EXCEL.forEach((c, i) => { hoja.getCell(1, i + 1).note = c.nota })
  hoja.views = [{ state: 'frozen', ySplit: 1 }]

  const columnaLista = (col: number, valores: string[]) => {
    valores.forEach((v, i) => { listas.getCell(i + 1, col).value = v })
    return `Listas!$${String.fromCharCode(64 + col)}$1:$${String.fromCharCode(64 + col)}$${Math.max(1, valores.length)}`
  }
  const rangoTramites = columnaLista(1, catalogos.tramites.map(t => t.nombre))
  const rangoOperaciones = columnaLista(2, catalogos.operaciones.map(o => o.nombre))
  const rangoEntidades = columnaLista(3, catalogos.entidades.map(e => e.nombre))
  for (let fila = 2; fila <= MAXIMO_FILAS + 1; fila++) {
    hoja.getCell(fila, 6).dataValidation = { type: 'list', allowBlank: true, formulae: [rangoTramites] }
    hoja.getCell(fila, 8).dataValidation = { type: 'list', allowBlank: true, formulae: [rangoOperaciones] }
    hoja.getCell(fila, 9).dataValidation = { type: 'list', allowBlank: true, formulae: [rangoEntidades] }
    hoja.getCell(fila, 11).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Si,No"'] }
    hoja.getCell(fila, 10).numFmt = 'dd/mm/yyyy'
  }
  return Buffer.from(await libro.xlsx.writeBuffer())
}

const fechaDeCelda = (valor: unknown): string => {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}-${String(valor.getDate()).padStart(2, '0')}`
  }
  const t = texto(valor)
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : ''
}

// Lee el Excel (la plantilla nueva por nombres o la vieja con ids) y devuelve las filas tal
// cual, como texto, para que la pantalla las resuelva contra los catálogos y las muestre
export const leerExcel = (buffer: Buffer) => {
  const libro = XLSX.read(buffer, { cellDates: true })
  const hoja = libro.Sheets[libro.SheetNames[0]]
  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: '', raw: true })
  if (filas.length > MAXIMO_FILAS) throw new ErrorGastos(`El archivo tiene ${filas.length} filas: máximo ${MAXIMO_FILAS}`)

  const valor = (f: Record<string, unknown>, ...nombres: string[]) => {
    const clave = Object.keys(f).find(k => nombres.some(n => normalizar(k) === normalizar(n)))
    return clave ? f[clave] : ''
  }
  return filas
    .map(f => ({
      placa: texto(valor(f, 'Placa', 'placa')),
      matricula: texto(valor(f, 'Matrícula', 'matriculaInmobiliaria', 'Matricula inmobiliaria')),
      detalle: texto(valor(f, 'Detalle', 'detalleSolicitud')),
      direccion: texto(valor(f, 'Dirección', 'direccionTramite')),
      municipio: texto(valor(f, 'Municipio', 'municipiosId')),
      tramite: texto(valor(f, 'Tipo de trámite', 'tramiteId')),
      cliente: texto(valor(f, 'Cliente', 'clienteId')),
      operacion: texto(valor(f, 'Operación', 'operacionesId')),
      entidad: texto(valor(f, 'Entidad', 'entidadId')),
      fechaEntregaResultado: fechaDeCelda(valor(f, 'Fecha entrega', 'fechaEntregaResultado')),
      documentosAportados: texto(valor(f, 'Documentos aportados', 'documentosAportados')),
      gastoConcepto: texto(valor(f, 'Gasto: concepto')),
      gastoValor: texto(valor(f, 'Gasto: valor')),
      gastoBeneficiario: texto(valor(f, 'Gasto: beneficiario')),
      gastoTransito: texto(valor(f, 'Gasto: tránsito', 'Gasto: transito'))
    }))
    // Se ignoran las filas totalmente vacías
    .filter(f => Object.values(f).some(Boolean))
}

// Beneficiarios por identificación (para las filas pegadas o importadas con gasto)
export const beneficiariosPorIdentificacion = async (identificaciones: string[]) =>
  identificaciones.length
    ? (await Terceros.findAll({ where: { identificacion: identificaciones }, attributes: ['id', 'identificacion', 'nombre'] }))
      .map(t => ({ id: t.id, identificacion: t.identificacion, nombre: t.nombre }))
    : []

