import type { Transaction } from 'sequelize'
import { db } from '../../config/db'
import Operaciones from '../../models/operaciones'
import SolicitudTramites from '../../models/solicitudTramites'
import Tramitador from '../../models/tramitador'
import TiposGasto from '../../models/gastos/tiposGasto'
import FormasPago from '../../models/gastos/formasPago'
import Terceros from '../../models/gastos/terceros'
import Bolsas from '../../models/gastos/bolsas'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import Anticipos from '../../models/gastos/anticipos'
import { cambiarEstadoGasto, codigoEstadoGasto, idEstadoGasto, registrarTrazabilidad } from './estadosGasto'
import { CLASES_ANTICIPO, ESTADOS_ANTICIPO, ESTADOS_GASTO, FORMA_PAGO_CAJA_MENOR, PARAMETROS, TIPOS_BOLSA, TIPOS_GASTO } from './constantes'
import { ErrorGastos } from './errores'
import { calcularRetencion } from './calculos'
import { obtenerParametro } from './parametros'


// =====================================
// TIPOS
// =====================================

export type DatosBeneficiario = {
  tipoIdentificacion?: string
  identificacion: string
  nombre: string
  banco?: string
  tipoCuenta?: string
  numeroCuenta?: string
  correo?: string
}

export type DatosGasto = {
  operacionId: number
  // Bolsa que se afectará con el pago. Se elige al crear; Tesorería puede cambiarla al pagar
  bolsaId: number
  solicitudTramiteId?: number | null
  tramitadorId?: number | null
  // Gasto creado desde el anticipo de un cliente: se paga de la bolsa del anticipo, no es
  // reembolsable y se descuenta del saldo del cliente
  anticipoId?: number | null
  tipoGastoId: number
  formaPagoId: number
  reembolsable?: boolean
  numeroFactura?: string | null
  conceptoPago: string
  matriculaInmobiliaria?: string | null
  placa?: string | null
  transito?: string | null
  contrato?: string | null
  nombreClienteBanco?: string | null
  identificacionClienteBanco?: string | null
  codigoBpr?: string | null
  // Valor del gasto (sin retención)
  valorSolicitado: number
  // Solo inmuebles: base (por defecto 0) y porcentaje en % (por defecto el parámetro, 11)
  baseRetencion?: number | null
  porcentajeRetencion?: number | null
  observacion?: string | null
  // Se envía uno de los dos: un tercero existente o los datos de uno nuevo
  beneficiarioId?: number | null
  beneficiario?: DatosBeneficiario | null
}


// =====================================
// UTILIDADES
// =====================================

// '  abc ' → 'abc'  |  '' o undefined → null
const texto = (valor: unknown): string | null => {
  const limpio = String(valor ?? '').trim()
  return limpio || null
}

const generarCodigo = (id: number, fecha: Date) =>
  `GAS-${fecha.getFullYear()}-${String(id).padStart(6, '0')}`

// Usa el tercero indicado o lo busca por identificación; si no existe, lo crea.
// Si ya existe NO se modifican sus datos bancarios (y el nombre no es obligatorio).
// En modo soloValidar no crea nada: solo verifica que se pueda resolver (devuelve 0 si sería nuevo).
const resolverBeneficiario = async (datos: DatosGasto, transaction: Transaction | undefined, soloValidar: boolean) => {
  if (datos.beneficiarioId) {
    const tercero = await Terceros.findByPk(datos.beneficiarioId, { transaction })
    if (!tercero) throw new ErrorGastos('El beneficiario seleccionado no existe')
    return tercero.id
  }

  const nuevo = datos.beneficiario
  const identificacion = texto(nuevo?.identificacion)
  const nombre = texto(nuevo?.nombre)

  if (!identificacion) {
    throw new ErrorGastos('Debe indicar la identificación del beneficiario del pago')
  }

  const existente = await Terceros.findOne({ where: { identificacion }, transaction })
  if (existente) return existente.id

  if (!nombre) {
    throw new ErrorGastos(`El beneficiario ${identificacion} no existe: indique su nombre para registrarlo`)
  }

  if (soloValidar) return 0

  const [tercero] = await Terceros.findOrCreate({
    where: { identificacion },
    defaults: {
      tipoIdentificacion: texto(nuevo?.tipoIdentificacion) ?? 'NIT',
      identificacion,
      nombre,
      banco: texto(nuevo?.banco),
      tipoCuenta: texto(nuevo?.tipoCuenta),
      numeroCuenta: texto(nuevo?.numeroCuenta),
      correo: texto(nuevo?.correo)
    },
    transaction
  })

  return tercero.id
}

// Reglas de la bolsa de un gasto nuevo o editado: con forma de pago Caja menor solo sirve una
// caja menor (Bogotá, Medellín…, la elige quien crea el gasto); con otra forma de pago, una caja no
function validarBolsaDelNuevoGasto(bolsa: Bolsas | null, porCajaMenor: boolean, deAnticipo: boolean, reembolsable: boolean): asserts bolsa is Bolsas {
  if (!bolsa?.activo) throw new ErrorGastos(porCajaMenor ? 'Seleccione la caja menor de la que sale el gasto' : 'La bolsa no existe o está inactiva')
  if (porCajaMenor && bolsa.tipo !== TIPOS_BOLSA.CAJA_MENOR) {
    throw new ErrorGastos('Con forma de pago Caja menor, seleccione la caja menor de la que sale el gasto')
  }
  if (!deAnticipo && bolsa.tipo === TIPOS_BOLSA.ANTICIPOS) {
    throw new ErrorGastos(`La bolsa ${bolsa.nombre} es de anticipos: solo paga gastos creados desde un anticipo confirmado`)
  }
  if (bolsa.tipo === TIPOS_BOLSA.FACTURAS) {
    throw new ErrorGastos(`La bolsa ${bolsa.nombre} es de anticipos facturados: no paga gastos`)
  }
  if (!porCajaMenor && bolsa.tipo === TIPOS_BOLSA.CAJA_MENOR) {
    throw new ErrorGastos(`${bolsa.nombre} es una caja menor: elija la forma de pago Caja menor`)
  }
  if (bolsa.sinSaldo && reembolsable) {
    throw new ErrorGastos(`La bolsa ${bolsa.nombre} es de no reembolsables: marque el gasto como no reembolsable o elija otra bolsa`)
  }
}

// Valida relaciones y reglas por tipo de gasto, y calcula los valores.
// Devuelve los campos listos para guardar. Con soloValidar no escribe nada en la base de datos.
const prepararDatos = async (datos: DatosGasto, transaction?: Transaction, soloValidar = false) => {

  const anticipo = datos.anticipoId
    ? await Anticipos.findByPk(datos.anticipoId, { include: [{ model: Terceros, attributes: ['nombre', 'identificacion'] }], transaction })
    : null
  if (datos.anticipoId) {
    if (!anticipo) throw new ErrorGastos('El anticipo no existe')
    if (anticipo.clase === CLASES_ANTICIPO.FACTURA) {
      throw new ErrorGastos(`${anticipo.codigo} es una solicitud de factura: no genera gastos`)
    }
    if (anticipo.estado !== ESTADOS_ANTICIPO.CONFIRMADO) {
      throw new ErrorGastos(`El anticipo ${anticipo.codigo} aún no está confirmado por Contabilidad`)
    }
  }

  const formaPago = await FormasPago.findByPk(datos.formaPagoId, { transaction })
  if (!formaPago?.activo) throw new ErrorGastos('La forma de pago no existe o está inactiva')

  const porCajaMenor = formaPago.codigo === FORMA_PAGO_CAJA_MENOR
  if (porCajaMenor && anticipo) throw new ErrorGastos('Los gastos de anticipos no se pagan por caja menor')

  const [tipoGasto, operacion, bolsa] = await Promise.all([
    TiposGasto.findByPk(datos.tipoGastoId, { transaction }),
    Operaciones.findByPk(datos.operacionId, { transaction }),
    // El gasto de un anticipo siempre sale de la bolsa del anticipo
    Bolsas.findByPk(anticipo?.bolsaId ?? datos.bolsaId, { transaction })
  ])

  if (!tipoGasto?.activo) throw new ErrorGastos('El tipo de gasto no existe')
  if (!operacion) throw new ErrorGastos('La operación no existe')
  // Por defecto reembolsable (se le cobra al cliente). El de un anticipo no: el cliente ya pagó
  const reembolsable = anticipo ? false : datos.reembolsable ?? true
  validarBolsaDelNuevoGasto(bolsa, porCajaMenor, Boolean(anticipo), reembolsable)


  let tramitadorId = datos.tramitadorId ?? null
  let placa = texto(datos.placa)?.toUpperCase() ?? null
  let matriculaInmobiliaria = texto(datos.matriculaInmobiliaria)

  // Si el gasto es de un trámite, se completan los datos que falten desde el trámite
  if (datos.solicitudTramiteId) {
    const tramite = await SolicitudTramites.findByPk(datos.solicitudTramiteId, { transaction })
    if (!tramite) throw new ErrorGastos(`No existe el trámite ${datos.solicitudTramiteId}`)

    tramitadorId ??= tramite.tramitadorId ?? null
    placa ??= texto(tramite.placa)?.toUpperCase() ?? null
    matriculaInmobiliaria ??= texto(tramite.matriculaInmobiliaria)
  }

  if (tramitadorId && !(await Tramitador.findByPk(tramitadorId, { transaction }))) {
    throw new ErrorGastos('El tramitador no existe')
  }

  // Reglas por tipo: cada tipo guarda solo sus campos de identificación
  let transito = texto(datos.transito)

  if (tipoGasto.codigo === TIPOS_GASTO.VEHICULO) {
    if (!placa || !transito) throw new ErrorGastos('Para gastos de vehículo la placa y el tránsito son obligatorios')
    matriculaInmobiliaria = null
  } else if (tipoGasto.codigo === TIPOS_GASTO.INMUEBLE) {
    if (!matriculaInmobiliaria) throw new ErrorGastos('Para gastos de inmueble la matrícula inmobiliaria es obligatoria')
    placa = null
    transito = null
  } else if (tipoGasto.codigo === TIPOS_GASTO.CTL) {
    // El CTL puede ser de un vehículo o de un inmueble: placa y matrícula opcionales
    transito = null
  } else if (tipoGasto.codigo === TIPOS_GASTO.CAMARA_COMERCIO) {
    // El certificado de Cámara de Comercio puede ir con la placa o la matrícula (ambas opcionales)
    transito = null
  } else if (tipoGasto.codigo === TIPOS_GASTO.RUNT) {
    // El certificado RUNT es de un vehículo: placa opcional
    matriculaInmobiliaria = null
    transito = null
  } else {
    placa = null
    transito = null
    matriculaInmobiliaria = null
  }

  const valorSolicitado = Math.round(Number(datos.valorSolicitado) * 100) / 100
  if (!(valorSolicitado > 0)) throw new ErrorGastos('El valor solicitado debe ser mayor a cero')

  const retencion = tipoGasto.codigo === TIPOS_GASTO.INMUEBLE ? await prepararRetencion(datos) : RETENCION_VACIA

  return {
    operacionId: operacion.id,
    bolsaId: bolsa.id,
    solicitudTramiteId: datos.solicitudTramiteId ?? null,
    tramitadorId,
    anticipoId: anticipo?.id ?? null,
    tipoGastoId: tipoGasto.id,
    formaPagoId: formaPago.id,
    beneficiarioId: await resolverBeneficiario(datos, transaction, soloValidar),
    reembolsable,
    numeroFactura: texto(datos.numeroFactura),
    conceptoPago: texto(datos.conceptoPago),
    matriculaInmobiliaria,
    placa,
    transito,
    contrato: texto(datos.contrato),
    nombreClienteBanco: anticipo ? anticipo.cliente.nombre : texto(datos.nombreClienteBanco),
    identificacionClienteBanco: anticipo ? anticipo.cliente.identificacion : texto(datos.identificacionClienteBanco),
    codigoBpr: texto(datos.codigoBpr),
    valorSolicitadoPago: String(valorSolicitado),
    ...retencion,
    observacion: texto(datos.observacion)
  }
}

// Los gastos que no son de inmueble no llevan retención
const RETENCION_VACIA = { retencionBase: null, retencionPorcentaje: null, retencionValor: null, retencionTotalPagar: null }

// Retención de un gasto de inmueble: base por defecto 0 y porcentaje por defecto el parámetro (11 %)
const prepararRetencion = async (datos: DatosGasto) => {
  const base = Number(datos.baseRetencion ?? 0)
  if (!(base >= 0)) throw new ErrorGastos('La base de retención no puede ser negativa')

  const porcentaje = datos.porcentajeRetencion === null || datos.porcentajeRetencion === undefined
    ? await obtenerParametro(PARAMETROS.RETENCION_FUENTE)
    : Number(datos.porcentajeRetencion) / 100
  if (!(porcentaje >= 0 && porcentaje <= 1)) throw new ErrorGastos('El porcentaje de retención debe estar entre 0 y 100')

  const baseRedondeada = Math.round(base * 100) / 100
  const { retencionFuente, totalPagar } = calcularRetencion(baseRedondeada, porcentaje)

  return {
    retencionBase: String(baseRedondeada),
    retencionPorcentaje: String(porcentaje),
    retencionValor: String(retencionFuente),
    retencionTotalPagar: String(totalPagar)
  }
}


// =====================================
// OPERACIONES
// =====================================

// Valida un gasto sin guardarlo (lanza ErrorGastos con el motivo si no es válido)
export const validarGasto = async (datos: DatosGasto) => {
  await prepararDatos(datos, undefined, true)
}

export const crearGasto = (datos: DatosGasto, usuarioId: number) =>
  db.transaction(transaction => crearGastoEnTransaccion(datos, usuarioId, transaction))

// Crea el gasto dentro de una transacción existente (el cargue masivo crea todos o ninguno)
export const crearGastoEnTransaccion = async (datos: DatosGasto, usuarioId: number, transaction: Transaction) => {

    const campos = await prepararDatos(datos, transaction)
    const estadoId = await idEstadoGasto(ESTADOS_GASTO.SOLICITADO)

    const gasto = await SolicitudesGasto.create(
      { ...campos, estadoId, creadoPor: usuarioId },
      { transaction }
    )

    await gasto.update({ codigo: generarCodigo(gasto.id, gasto.createdAt) }, { transaction })

    await registrarTrazabilidad({
      solicitudGastoId: gasto.id,
      estadoAnteriorId: null,
      estadoNuevoId: estadoId,
      usuarioId,
      observacion: 'Gasto creado'
    }, transaction)

    return gasto
}

// Solo se puede editar mientras no se haya pagado
export const actualizarGasto = (gasto: SolicitudesGasto, datos: DatosGasto, usuarioId: number) =>
  db.transaction(async transaction => {

    if (await codigoEstadoGasto(gasto.estadoId) !== ESTADOS_GASTO.SOLICITADO) {
      throw new ErrorGastos('Solo se pueden editar gastos en estado Solicitado')
    }

    // El anticipo del que salió el gasto no se cambia al editarlo
    const campos = await prepararDatos({ ...datos, anticipoId: gasto.anticipoId }, transaction)

    await gasto.update({ ...campos, actualizadoPor: usuarioId }, { transaction })

    return gasto
  })

export const anularGasto = (gasto: SolicitudesGasto, motivo: string, usuarioId: number) =>
  db.transaction(transaction =>
    cambiarEstadoGasto(gasto, ESTADOS_GASTO.ANULADO, usuarioId, transaction, {
      observacion: motivo,
      cambios: { motivoAnulacion: motivo }
    })
  )
