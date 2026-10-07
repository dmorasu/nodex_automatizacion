import { Op, QueryTypes, type Transaction, type WhereOptions } from 'sequelize'
import { db } from '../../config/db'
import Anticipos from '../../models/gastos/anticipos'
import TrazabilidadAnticipos from '../../models/gastos/trazabilidadAnticipos'
import ClientesEmpresariales from '../../models/gastos/clientesEmpresariales'
import Terceros from '../../models/gastos/terceros'
import Bolsas from '../../models/gastos/bolsas'
import DocumentosGasto from '../../models/gastos/documentosGasto'
import TiposDocumentoGasto from '../../models/gastos/tiposDocumentoGasto'
import Operaciones from '../../models/operaciones'
import { subirArchivo, eliminarArchivo } from '../azureFileStorage'
import { nombreSeguro } from '../../controllers/gastos/DocumentosGastoController'
import { registrarMovimientos } from './bolsas'
import {
  ESTADOS_ANTICIPO, ESTADOS_GASTO, TIPOS_ANTICIPO, TIPOS_BOLSA, TIPOS_DOCUMENTO, TIPOS_MOVIMIENTO_BOLSA,
  type EstadoAnticipo
} from './constantes'
import { ErrorGastos } from './errores'
import { formatoMoneda } from './formato'

// =====================================
// ANTICIPOS DE CLIENTES DEL BANCO
// 1. La operación registra el anticipo con el soporte de la consignación (POR_CONFIRMAR).
// 2. Contabilidad revisa en el banco que el dinero entró:
//    · lo confirma con el recibo de caja y el valor que de verdad entró (CONFIRMADO): suma a la
//      bolsa de anticipos a nombre del cliente;
//    · o lo devuelve con novedad (NOVEDAD); el creador lo corrige y vuelve a POR_CONFIRMAR.
// 3. El creador lo convierte en gastos no reembolsables (solicitudesGasto.ts, con anticipoId),
//    que siguen el pago normal y al pagarse se descuentan de la bolsa y del saldo del cliente.
// =====================================

export type DatosCliente = {
  tipoIdentificacion: string
  identificacion: string
  nombre: string
  telefono: string
  direccion: string
}

export type DatosAnticipo = {
  tipo: string
  cliente: DatosCliente
  clienteEmpresarialId: number
  operacionId: number
  bolsaId: number
  concepto: string
  placa?: string | null
  matriculaInmobiliaria?: string | null
  valorConsignado: number
  fechaConsignacion: string
  observacion?: string | null
}

export type DatosConfirmacionAnticipo = {
  id: number
  valorRecibido: number
  reciboCaja: string
  observacion?: string | null
}

const CARPETA = 'gastos/anticipos'

const texto = (valor: unknown): string | null => String(valor ?? '').trim() || null
const redondear = (valor: number) => Math.round(Number(valor) * 100) / 100
const aCentavos = (valor: number | string | null | undefined) => Math.round(Number(valor ?? 0) * 100)

const generarCodigo = (id: number, fecha: Date) => `ANT-${fecha.getFullYear()}-${String(id).padStart(6, '0')}`

const registrarTrazabilidad = (
  anticipoId: number,
  estadoAnterior: string | null,
  estadoNuevo: string,
  usuarioId: number,
  observacion: string | null,
  transaction: Transaction
) => TrazabilidadAnticipos.create({ anticipoId, estadoAnterior, estadoNuevo, usuarioId, observacion }, { transaction })

const anticipoBloqueado = async (id: number, transaction: Transaction) => {
  const anticipo = await Anticipos.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })
  if (!anticipo) throw new ErrorGastos('El anticipo no existe', 404)
  return anticipo
}

// ── Cliente (queda como tercero para llevar su saldo) ──

// Lo busca por identificación; si no existe lo crea. Si existe, actualiza el teléfono y la
// dirección (su nombre y datos bancarios no se tocan: puede ser también beneficiario de pagos)
const resolverCliente = async (datos: DatosCliente, transaction: Transaction) => {
  const identificacion = texto(datos.identificacion)!
  const contacto = { telefono: texto(datos.telefono), direccion: texto(datos.direccion) }

  const existente = await Terceros.findOne({ where: { identificacion }, transaction })
  if (existente) {
    await existente.update(contacto, { transaction })
    return existente.id
  }

  const tercero = await Terceros.create({
    tipoIdentificacion: datos.tipoIdentificacion,
    identificacion,
    nombre: texto(datos.nombre),
    ...contacto
  }, { transaction })
  return tercero.id
}

// Valida catálogos y reglas por tipo; devuelve los campos listos para guardar
const prepararDatos = async (datos: DatosAnticipo, transaction: Transaction) => {
  const [bolsa, operacion, clienteEmpresarial] = await Promise.all([
    Bolsas.findByPk(datos.bolsaId, { transaction }),
    Operaciones.findByPk(datos.operacionId, { transaction }),
    ClientesEmpresariales.findByPk(datos.clienteEmpresarialId, { transaction })
  ])

  if (!bolsa?.activo) throw new ErrorGastos('La bolsa no existe o está inactiva')
  if (bolsa.tipo !== TIPOS_BOLSA.ANTICIPOS) throw new ErrorGastos(`La bolsa ${bolsa.nombre} no es de anticipos`)
  if (!operacion) throw new ErrorGastos('La operación no existe')
  if (!clienteEmpresarial?.activo) throw new ErrorGastos('El cliente empresarial no existe o está inactivo')

  const esVehiculo = datos.tipo === TIPOS_ANTICIPO.VEHICULO
  const placa = esVehiculo ? texto(datos.placa)?.toUpperCase() ?? null : null
  const matriculaInmobiliaria = esVehiculo ? null : texto(datos.matriculaInmobiliaria)
  if (esVehiculo && !placa) throw new ErrorGastos('La placa es obligatoria en los anticipos de vehículo')
  if (!esVehiculo && !matriculaInmobiliaria) throw new ErrorGastos('La matrícula inmobiliaria es obligatoria en los anticipos de inmueble')

  const valorConsignado = redondear(datos.valorConsignado)
  if (!(valorConsignado > 0)) throw new ErrorGastos('El valor consignado debe ser mayor a cero')

  return {
    tipo: datos.tipo,
    clienteId: await resolverCliente(datos.cliente, transaction),
    clienteEmpresarialId: clienteEmpresarial.id,
    operacionId: operacion.id,
    bolsaId: bolsa.id,
    concepto: texto(datos.concepto)!,
    placa,
    matriculaInmobiliaria,
    valorConsignado: String(valorConsignado),
    fechaConsignacion: datos.fechaConsignacion,
    observacion: texto(datos.observacion)
  }
}

// Sube los soportes a Azure y los registra en el anticipo (dentro de la transacción).
// Si algo falla, borra de Azure lo que alcanzó a subir.
const guardarSoportes = async (anticipo: Anticipos, archivos: Express.Multer.File[], usuarioId: number, transaction: Transaction) => {
  if (!archivos.length) return
  const tipoDocumento = await TiposDocumentoGasto.findOne({ where: { codigo: TIPOS_DOCUMENTO.SOPORTE_CONSIGNACION }, transaction })
  if (!tipoDocumento) throw new ErrorGastos('Falta el tipo de documento Soporte de consignación en el catálogo', 500)

  const rutaDirectorio = `${CARPETA}/${anticipo.codigo}`
  const subidos: string[] = []
  try {
    for (const archivo of archivos) {
      const nombreArchivo = nombreSeguro(archivo.originalname)
      await subirArchivo(rutaDirectorio, nombreArchivo, archivo.buffer)
      subidos.push(nombreArchivo)
    }
    await DocumentosGasto.bulkCreate(archivos.map((archivo, i) => ({
      anticipoId: anticipo.id,
      tipoDocumentoId: tipoDocumento.id,
      nombreOriginal: archivo.originalname,
      nombreArchivo: subidos[i],
      rutaDirectorio,
      tipoArchivo: archivo.mimetype,
      tamano: archivo.size,
      subidoPor: usuarioId
    })), { transaction })
  } catch (error) {
    await Promise.allSettled(subidos.map(nombre => eliminarArchivo(rutaDirectorio, nombre)))
    throw error
  }
}

// ── Operación: registrar, corregir y anular ──

export const crearAnticipo = (datos: DatosAnticipo, archivos: Express.Multer.File[], usuarioId: number) => {
  if (!archivos.length) throw new ErrorGastos('Adjunte el soporte de la consignación')

  return db.transaction(async transaction => {
    const campos = await prepararDatos(datos, transaction)
    const anticipo = await Anticipos.create({ ...campos, estado: ESTADOS_ANTICIPO.POR_CONFIRMAR, creadoPor: usuarioId }, { transaction })
    await anticipo.update({ codigo: generarCodigo(anticipo.id, anticipo.createdAt) }, { transaction })
    await registrarTrazabilidad(anticipo.id, null, ESTADOS_ANTICIPO.POR_CONFIRMAR, usuarioId, 'Anticipo registrado', transaction)
    await guardarSoportes(anticipo, archivos, usuarioId, transaction)
    return anticipo
  })
}

const EDITABLES: string[] = [ESTADOS_ANTICIPO.POR_CONFIRMAR, ESTADOS_ANTICIPO.NOVEDAD]

// El creador lo corrige mientras Contabilidad no lo haya confirmado.
// Si tenía novedad, vuelve a Contabilidad (POR_CONFIRMAR).
export const actualizarAnticipo = (id: number, datos: DatosAnticipo, archivos: Express.Multer.File[], usuarioId: number) =>
  db.transaction(async transaction => {
    const anticipo = await anticipoBloqueado(id, transaction)
    if (!EDITABLES.includes(anticipo.estado)) throw new ErrorGastos('Solo se puede corregir un anticipo por confirmar o con novedad')

    const campos = await prepararDatos(datos, transaction)
    await guardarSoportes(anticipo, archivos, usuarioId, transaction)
    if (!(await DocumentosGasto.count({ where: { anticipoId: anticipo.id }, transaction }))) {
      throw new ErrorGastos('Adjunte el soporte de la consignación')
    }

    const estadoAnterior = anticipo.estado
    await anticipo.update({ ...campos, estado: ESTADOS_ANTICIPO.POR_CONFIRMAR, actualizadoPor: usuarioId }, { transaction })
    await registrarTrazabilidad(
      anticipo.id, estadoAnterior, ESTADOS_ANTICIPO.POR_CONFIRMAR, usuarioId,
      estadoAnterior === ESTADOS_ANTICIPO.NOVEDAD ? 'Corregido y enviado de nuevo a Contabilidad' : 'Datos corregidos',
      transaction
    )
    return { anticipo, reenviado: estadoAnterior === ESTADOS_ANTICIPO.NOVEDAD }
  })

export const anularAnticipo = (id: number, motivo: string, usuarioId: number) =>
  db.transaction(async transaction => {
    const anticipo = await anticipoBloqueado(id, transaction)
    if (!EDITABLES.includes(anticipo.estado)) throw new ErrorGastos('Solo se puede anular un anticipo por confirmar o con novedad')

    const estadoAnterior = anticipo.estado
    await anticipo.update({ estado: ESTADOS_ANTICIPO.ANULADO, motivoAnulacion: motivo.trim(), actualizadoPor: usuarioId }, { transaction })
    await registrarTrazabilidad(anticipo.id, estadoAnterior, ESTADOS_ANTICIPO.ANULADO, usuarioId, motivo.trim(), transaction)
  })

// ── Contabilidad: novedad y confirmación ──

export const marcarNovedad = (id: number, motivo: string, usuarioId: number) =>
  db.transaction(async transaction => {
    const anticipo = await anticipoBloqueado(id, transaction)
    if (anticipo.estado !== ESTADOS_ANTICIPO.POR_CONFIRMAR) throw new ErrorGastos(`El anticipo ${anticipo.codigo} no está por confirmar`)

    await anticipo.update({ estado: ESTADOS_ANTICIPO.NOVEDAD, motivoNovedad: motivo.trim() }, { transaction })
    await registrarTrazabilidad(anticipo.id, ESTADOS_ANTICIPO.POR_CONFIRMAR, ESTADOS_ANTICIPO.NOVEDAD, usuarioId, motivo.trim(), transaction)
    return anticipo
  })

// Confirma uno o varios anticipos (cargue masivo de recibos de caja): todos o ninguno.
// Cada uno suma a su bolsa lo que de verdad entró, a nombre de su cliente.
export const confirmarAnticipos = (lista: DatosConfirmacionAnticipo[], usuarioId: number) =>
  db.transaction(async transaction => {
    const ids = lista.map(a => a.id)
    if (new Set(ids).size !== ids.length) throw new ErrorGastos('Hay anticipos repetidos en la confirmación')

    // Se bloquean para que nadie los confirme dos veces al mismo tiempo
    const anticipos = await Anticipos.findAll({
      where: { id: { [Op.in]: ids } }, transaction, lock: transaction.LOCK.UPDATE, order: [['id', 'ASC']]
    })
    if (anticipos.length !== ids.length) throw new ErrorGastos('Uno o más anticipos no existen')

    const porBolsa = new Map<number, { anticipo: Anticipos, datos: DatosConfirmacionAnticipo }[]>()
    for (const anticipo of anticipos) {
      if (anticipo.estado !== ESTADOS_ANTICIPO.POR_CONFIRMAR) throw new ErrorGastos(`El anticipo ${anticipo.codigo} ya no está por confirmar`)
      const datos = lista.find(a => a.id === anticipo.id)!
      if (!(redondear(datos.valorRecibido) > 0)) throw new ErrorGastos(`El valor recibido del anticipo ${anticipo.codigo} debe ser mayor a cero`)
      if (!texto(datos.reciboCaja)) throw new ErrorGastos(`Indique el recibo de caja del anticipo ${anticipo.codigo}`)
      porBolsa.set(anticipo.bolsaId, [...(porBolsa.get(anticipo.bolsaId) ?? []), { anticipo, datos }])
    }

    for (const [bolsaId, grupo] of porBolsa) {
      await registrarMovimientos(bolsaId, grupo.map(({ anticipo, datos }) => ({
        tipo: TIPOS_MOVIMIENTO_BOLSA.ANTICIPO,
        valor: redondear(datos.valorRecibido),
        anticipoId: anticipo.id,
        clienteId: anticipo.clienteId,
        observacion: `Anticipo ${anticipo.codigo} · recibo de caja ${texto(datos.reciboCaja)}`
      })), usuarioId, transaction)
    }

    for (const anticipo of anticipos) {
      const datos = lista.find(a => a.id === anticipo.id)!
      const valorRecibido = redondear(datos.valorRecibido)
      const diferencia = (aCentavos(valorRecibido) - aCentavos(anticipo.valorConsignado)) / 100
      await anticipo.update({
        estado: ESTADOS_ANTICIPO.CONFIRMADO,
        valorRecibido: String(valorRecibido),
        reciboCaja: texto(datos.reciboCaja),
        observacionContabilidad: texto(datos.observacion),
        confirmadoPor: usuarioId,
        fechaConfirmacion: new Date()
      }, { transaction })
      await registrarTrazabilidad(
        anticipo.id, ESTADOS_ANTICIPO.POR_CONFIRMAR, ESTADOS_ANTICIPO.CONFIRMADO, usuarioId,
        [
          `Recibo de caja ${texto(datos.reciboCaja)} por ${formatoMoneda(valorRecibido)}`,
          diferencia !== 0 ? `diferencia con lo consignado: ${formatoMoneda(diferencia)}` : null,
          texto(datos.observacion)
        ].filter(Boolean).join(' · '),
        transaction
      )
    }

    return anticipos.map(a => a.id)
  })

// ── Saldos por cliente ──

// Gastos de anticipos que aún no se pagan: comprometen el saldo del cliente
const ESTADOS_COMPROMETIDOS = [ESTADOS_GASTO.SOLICITADO, ESTADOS_GASTO.PROGRAMADO, ESTADOS_GASTO.APROBADO_PAGO]

export type SaldoCliente = {
  clienteId: number
  nombre: string
  tipoIdentificacion: string
  identificacion: string
  ingresado: number      // anticipos confirmados (valor recibido)
  pagado: number         // gastos pagados
  otros: number          // reintegros y ajustes
  saldo: number          // lo que tiene hoy en la bolsa
  comprometido: number   // gastos creados aún sin pagar
  disponible: number     // saldo − comprometido (negativo = faltante; positivo = sobrante si ya no hay gastos)
  ultimoMovimiento: string | null
}

// Saldo de cada cliente en una bolsa de anticipos (la suma de los saldos = saldo de la bolsa)
export const saldosPorCliente = async (bolsaId: number, clienteIds?: number[], transaction?: Transaction): Promise<SaldoCliente[]> => {
  const filtroCliente = clienteIds?.length ? 'AND m.cliente_id IN (:clienteIds)' : ''
  const filtroClienteGasto = clienteIds?.length ? 'AND a.cliente_id IN (:clienteIds)' : ''

  const [movimientos, comprometidos] = await Promise.all([
    db.query<Record<string, string>>(`
      SELECT m.cliente_id AS "clienteId", t.nombre, t.tipo_identificacion AS "tipoIdentificacion", t.identificacion,
        COALESCE(SUM(m.valor) FILTER (WHERE m.tipo = 'ANTICIPO'), 0) AS ingresado,
        COALESCE(-SUM(m.valor) FILTER (WHERE m.tipo = 'PAGO'), 0) AS pagado,
        COALESCE(SUM(m.valor) FILTER (WHERE m.tipo NOT IN ('ANTICIPO', 'PAGO')), 0) AS otros,
        SUM(m.valor) AS saldo,
        MAX(m.created_at) AS "ultimoMovimiento"
      FROM gastos_movimientos_bolsa m
      JOIN gastos_terceros t ON t.id = m.cliente_id
      WHERE m.bolsa_id = :bolsaId ${filtroCliente}
      GROUP BY m.cliente_id, t.nombre, t.tipo_identificacion, t.identificacion
      ORDER BY t.nombre
    `, { replacements: { bolsaId, clienteIds }, type: QueryTypes.SELECT, transaction }),
    db.query<{ clienteId: number, comprometido: string }>(`
      SELECT a.cliente_id AS "clienteId", SUM(COALESCE(g.valor_programado, g.valor_solicitado_pago)) AS comprometido
      FROM gastos_solicitudes g
      JOIN gastos_anticipos a ON a.id = g.anticipo_id
      JOIN gastos_estados_gasto e ON e.id = g.estado_id AND e.codigo IN (:comprometidos)
      WHERE a.bolsa_id = :bolsaId ${filtroClienteGasto}
      GROUP BY a.cliente_id
    `, { replacements: { bolsaId, clienteIds, comprometidos: ESTADOS_COMPROMETIDOS }, type: QueryTypes.SELECT, transaction })
  ])

  return movimientos.map(fila => {
    const saldo = Number(fila.saldo)
    const comprometido = Number(comprometidos.find(c => Number(c.clienteId) === Number(fila.clienteId))?.comprometido ?? 0)
    return {
      clienteId: Number(fila.clienteId),
      nombre: fila.nombre,
      tipoIdentificacion: fila.tipoIdentificacion,
      identificacion: fila.identificacion,
      ingresado: Number(fila.ingresado),
      pagado: Number(fila.pagado),
      otros: Number(fila.otros),
      saldo,
      comprometido,
      disponible: (aCentavos(saldo) - aCentavos(comprometido)) / 100,
      ultimoMovimiento: fila.ultimoMovimiento ? new Date(fila.ultimoMovimiento).toISOString() : null
    }
  })
}

// ── Arqueo de una bolsa de anticipos (pantalla y Excel) ──

export const FILTROS_ARQUEO = ['faltante', 'porPagar', 'sobrante', 'inactivos'] as const
export const ORDENES_ARQUEO = ['faltante', 'saldo', 'reciente', 'nombre'] as const
export type FiltroArqueo = typeof FILTROS_ARQUEO[number]
export type OrdenArqueo = typeof ORDENES_ARQUEO[number]

const DIAS_INACTIVO = 30

// Clasificación de cada cliente para los filtros rápidos
const cumple: Record<FiltroArqueo, (c: SaldoCliente, limiteInactivo: number) => boolean> = {
  faltante: c => c.disponible < 0,
  porPagar: c => c.comprometido > 0,
  // Le sobra plata y ya no tiene gastos por pagar
  sobrante: c => c.disponible > 0 && c.comprometido === 0,
  inactivos: (c, limite) => !c.ultimoMovimiento || new Date(c.ultimoMovimiento).getTime() < limite
}

const ordenar: Record<OrdenArqueo, (a: SaldoCliente, b: SaldoCliente) => number> = {
  // Faltantes primero (el más negativo arriba), luego por nombre
  faltante: (a, b) => a.disponible - b.disponible || a.nombre.localeCompare(b.nombre),
  saldo: (a, b) => b.saldo - a.saldo || a.nombre.localeCompare(b.nombre),
  reciente: (a, b) => (b.ultimoMovimiento ?? '').localeCompare(a.ultimoMovimiento ?? ''),
  nombre: (a, b) => a.nombre.localeCompare(b.nombre)
}

const sumar = (valores: number[]) => valores.reduce((total, v) => total + Math.round(v * 100), 0) / 100

// Totales y conteos sobre TODOS los clientes (el cuadre no depende del filtro); la lista
// viene filtrada, ordenada y paginada. Sin `tamano`, todos (para el Excel).
export const arqueoDeBolsa = async (bolsaId: number, saldoBolsa: string, opciones: {
  busqueda?: string | null, filtro?: FiltroArqueo | null, orden?: OrdenArqueo | null, pagina?: number, tamano?: number | null
} = {}) => {
  const clientes = await saldosPorCliente(bolsaId)
  const limiteInactivo = Date.now() - DIAS_INACTIVO * 86400000
  const saldoClientes = sumar(clientes.map(c => c.saldo))

  const texto = opciones.busqueda?.trim().toLowerCase()
  const filtrados = clientes
    .filter(c => !texto || c.nombre.toLowerCase().includes(texto) || c.identificacion.toLowerCase().includes(texto))
    .filter(c => !opciones.filtro || cumple[opciones.filtro](c, limiteInactivo))
    .sort(ordenar[opciones.orden ?? 'faltante'])

  const tamano = opciones.tamano ?? null
  const pagina = Math.max(1, opciones.pagina ?? 1)

  return {
    totales: {
      clientes: clientes.length,
      saldo: saldoClientes,
      comprometido: sumar(clientes.map(c => c.comprometido)),
      sobrantes: sumar(clientes.filter(c => c.disponible > 0).map(c => c.disponible)),
      faltantes: sumar(clientes.filter(c => c.disponible < 0).map(c => c.disponible)),
      // Saldo de la bolsa menos la suma de sus clientes: debe ser 0
      diferencia: sumar([Number(saldoBolsa), -saldoClientes])
    },
    conteos: Object.fromEntries(FILTROS_ARQUEO.map(f => [f, clientes.filter(c => cumple[f](c, limiteInactivo)).length])) as Record<FiltroArqueo, number>,
    total: filtrados.length,
    pagina,
    tamano: tamano ?? filtrados.length,
    clientes: tamano ? filtrados.slice((pagina - 1) * tamano, pagina * tamano) : filtrados
  }
}

export const saldoDelCliente = async (bolsaId: number, clienteId: number, transaction?: Transaction) =>
  (await saldosPorCliente(bolsaId, [clienteId], transaction))[0] ?? null

type FilaMovimiento = {
  id: number, tipo: string, valor: string, fecha: Date, dia: string, observacion: string | null, lotePagoId: number | null,
  gastoId: number | null, gastoCodigo: string | null, gastoConcepto: string | null, beneficiario: string | null,
  anticipoId: number | null, anticipoCodigo: string | null, reciboCaja: string | null, anticipoConcepto: string | null,
  usuario: string | null
}
type FilaPorPagar = {
  id: number, codigo: string, concepto: string, valor: string, estadoCodigo: string, estado: string, fecha: Date, anticipoCodigo: string | null
}

// Estado de cuenta de un cliente en una bolsa de anticipos: sus movimientos con el saldo corrido
// (opcionalmente de un período, con el saldo al inicio), sus gastos por pagar y sus anticipos.
// Las fechas son días de Colombia (YYYY-MM-DD).
export const estadoDeCuentaCliente = async (bolsaId: number, clienteId: number, periodo: { desde?: string | null, hasta?: string | null } = {}) => {
  const [cliente, saldo, movimientos, porPagar, anticipos] = await Promise.all([
    Terceros.findByPk(clienteId, { attributes: ['id', 'nombre', 'tipoIdentificacion', 'identificacion', 'telefono', 'direccion'] }),
    saldoDelCliente(bolsaId, clienteId),
    db.query<FilaMovimiento>(`
      SELECT m.id, m.tipo, m.valor, m.created_at AS "fecha", m.observacion, m.lote_pago_id AS "lotePagoId",
        (m.created_at AT TIME ZONE 'America/Bogota')::date::text AS "dia",
        g.id AS "gastoId", g.codigo AS "gastoCodigo", g.concepto_pago AS "gastoConcepto", b.nombre AS "beneficiario",
        a.id AS "anticipoId", a.codigo AS "anticipoCodigo", a.recibo_caja AS "reciboCaja", a.concepto AS "anticipoConcepto",
        u."nombreUsuario" AS "usuario"
      FROM gastos_movimientos_bolsa m
      LEFT JOIN gastos_solicitudes g ON g.id = m.solicitud_gasto_id
      LEFT JOIN gastos_terceros b ON b.id = g.beneficiario_id
      LEFT JOIN gastos_anticipos a ON a.id = COALESCE(m.anticipo_id, g.anticipo_id)
      LEFT JOIN "Usuarios" u ON u.id = m.usuario_id
      WHERE m.bolsa_id = :bolsaId AND m.cliente_id = :clienteId
      ORDER BY m.id
    `, { replacements: { bolsaId, clienteId }, type: QueryTypes.SELECT }),
    db.query<FilaPorPagar>(`
      SELECT g.id, g.codigo, g.concepto_pago AS "concepto", COALESCE(g.valor_programado, g.valor_solicitado_pago) AS "valor",
        e.codigo AS "estadoCodigo", e.nombre AS "estado", g.created_at AS "fecha", a.codigo AS "anticipoCodigo"
      FROM gastos_solicitudes g
      JOIN gastos_anticipos a ON a.id = g.anticipo_id AND a.bolsa_id = :bolsaId AND a.cliente_id = :clienteId
      JOIN gastos_estados_gasto e ON e.id = g.estado_id AND e.codigo IN (:comprometidos)
      ORDER BY g.created_at
    `, { replacements: { bolsaId, clienteId, comprometidos: ESTADOS_COMPROMETIDOS }, type: QueryTypes.SELECT }),
    Anticipos.findAll({
      where: { bolsaId, clienteId },
      attributes: ['id', 'codigo', 'estado', 'concepto', 'placa', 'matriculaInmobiliaria', 'valorConsignado', 'valorRecibido', 'reciboCaja', 'fechaConsignacion', 'createdAt'],
      order: [['createdAt', 'DESC']]
    })
  ])
  if (!cliente) throw new ErrorGastos('El cliente no existe', 404)

  // Saldo corrido sobre todos los movimientos; luego se toma el período
  let acumulado = 0
  const conSaldo = movimientos.map(m => {
    acumulado += aCentavos(m.valor)
    return { ...m, valor: Number(m.valor), saldo: acumulado / 100 }
  })
  const enPeriodo = conSaldo.filter(m =>
    (!periodo.desde || String(m.dia) >= periodo.desde) && (!periodo.hasta || String(m.dia) <= periodo.hasta))
  const anteriores = periodo.desde ? conSaldo.filter(m => String(m.dia) < periodo.desde!) : []
  const sumar = (lista: { valor: number }[]) => lista.reduce((t, m) => t + aCentavos(m.valor), 0) / 100

  return {
    cliente,
    saldo,
    periodo: {
      desde: periodo.desde ?? null,
      hasta: periodo.hasta ?? null,
      saldoInicial: anteriores.length ? anteriores[anteriores.length - 1].saldo : 0,
      entradas: sumar(enPeriodo.filter(m => m.valor > 0)),
      salidas: sumar(enPeriodo.filter(m => m.valor < 0)),
      saldoFinal: enPeriodo.length ? enPeriodo[enPeriodo.length - 1].saldo : (anteriores.length ? anteriores[anteriores.length - 1].saldo : 0)
    },
    movimientos: enPeriodo,
    porPagar: porPagar.map(g => ({ ...g, valor: Number(g.valor) })),
    anticipos
  }
}

// Aviso cuando los gastos del cliente (sin pagar) superan su saldo. null si alcanza.
export const avisoSaldoCliente = async (anticipoId: number) => {
  const anticipo = await Anticipos.findByPk(anticipoId, { attributes: ['bolsaId', 'clienteId'], include: [{ model: Terceros, attributes: ['nombre'] }] })
  if (!anticipo) return null
  const saldo = await saldoDelCliente(anticipo.bolsaId, anticipo.clienteId)
  if (!saldo || saldo.disponible >= 0) return null
  return `Los gastos por pagar de ${anticipo.cliente?.nombre ?? 'este cliente'} (${formatoMoneda(saldo.comprometido)}) ` +
    `superan su saldo (${formatoMoneda(saldo.saldo)}): faltan ${formatoMoneda(-saldo.disponible)}`
}

// ── Consultas ──

export type FiltrosAnticipos = {
  creadoPor?: number | null
  estado?: string | null
  tipo?: string | null
  bolsaId?: number | null
  busqueda?: string | null
  pagina: number
  tamano: number
}

const INCLUDES_LISTADO = [
  { model: Terceros, attributes: ['id', 'tipoIdentificacion', 'identificacion', 'nombre'] },
  { model: ClientesEmpresariales, attributes: ['id', 'nombre'] },
  { model: Bolsas, attributes: ['id', 'nombre'] },
  { model: Operaciones, attributes: ['id', 'nombreOperacion'] }
]

export const listarAnticipos = async (filtros: FiltrosAnticipos) => {
  const condiciones: WhereOptions[] = []
  if (filtros.creadoPor) condiciones.push({ creadoPor: filtros.creadoPor })
  if (filtros.estado) condiciones.push({ estado: filtros.estado.split(',') })
  if (filtros.tipo) condiciones.push({ tipo: filtros.tipo })
  if (filtros.bolsaId) condiciones.push({ bolsaId: filtros.bolsaId })

  const busqueda = texto(filtros.busqueda)
  if (busqueda) {
    const patron = { [Op.iLike]: `%${busqueda}%` }
    condiciones.push({
      [Op.or]: [
        { codigo: patron }, { placa: patron }, { matriculaInmobiliaria: patron },
        { reciboCaja: patron }, { '$cliente.nombre$': patron }, { '$cliente.identificacion$': patron }
      ]
    })
  }

  const { count, rows } = await Anticipos.findAndCountAll({
    where: { [Op.and]: condiciones },
    include: INCLUDES_LISTADO,
    attributes: {
      exclude: ['observacion', 'observacionContabilidad', 'motivoAnulacion'],
      // Cuántos gastos se han creado del anticipo
      include: [[db.literal(`(SELECT COUNT(*) FROM gastos_solicitudes g WHERE g.anticipo_id = "Anticipos"."id")`), 'cantidadGastos']]
    },
    // Lo más antiguo primero mientras está pendiente (así trabaja Contabilidad)
    order: [['createdAt', filtros.estado === ESTADOS_ANTICIPO.POR_CONFIRMAR ? 'ASC' : 'DESC']],
    limit: filtros.tamano,
    offset: (Math.max(1, filtros.pagina) - 1) * filtros.tamano,
    distinct: true
  })

  return { total: count, pagina: filtros.pagina, tamano: filtros.tamano, registros: rows }
}

export const contarAnticipos = (estado: EstadoAnticipo, creadoPor?: number) =>
  Anticipos.count({ where: { estado, ...(creadoPor ? { creadoPor } : {}) } })
