import type { Transaction } from 'sequelize'
import EstadosGasto from '../../models/gastos/estadosGasto'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import TrazabilidadGastos from '../../models/gastos/trazabilidadGastos'
import { ESTADOS_GASTO } from './constantes'
import { ErrorGastos } from './errores'

export type CodigoEstadoGasto = typeof ESTADOS_GASTO[keyof typeof ESTADOS_GASTO]

// Qué estados pueden seguir a cada estado. Cualquier otro cambio se rechaza.
const TRANSICIONES: Record<CodigoEstadoGasto, CodigoEstadoGasto[]> = {
  SOLICITADO: ['PROGRAMADO', 'PAGADO', 'ANULADO'],   // PAGADO directo = compras de certificados
  PROGRAMADO: ['APROBADO_PAGO', 'SOLICITADO'],     // SOLICITADO = rechazado o quitado del lote
  APROBADO_PAGO: ['PAGADO', 'SOLICITADO'],
  PAGADO: ['FACTURADO'],
  FACTURADO: ['EN_CUENTA_COBRO', 'LEGALIZADO'],   // LEGALIZADO directo = no reembolsable
  EN_CUENTA_COBRO: ['FACTURADO', 'LEGALIZADO'],   // FACTURADO = se sacó de la cuenta de cobro
  LEGALIZADO: ['CONTABILIZADO'],
  CONTABILIZADO: [],
  ANULADO: []
}

// Los estados casi nunca cambian: se guardan en memoria código ↔ id
let cache: { porCodigo: Map<string, number>, porId: Map<number, string> } | null = null

const cargarEstados = async () => {
  if (cache) return cache

  const estados = await EstadosGasto.findAll({ attributes: ['id', 'codigo'] })

  cache = {
    porCodigo: new Map(estados.map(e => [e.codigo, e.id])),
    porId: new Map(estados.map(e => [e.id, e.codigo]))
  }

  return cache
}

export const idEstadoGasto = async (codigo: CodigoEstadoGasto): Promise<number> => {
  const { porCodigo } = await cargarEstados()
  const id = porCodigo.get(codigo)

  if (!id) throw new Error(`No existe el estado de gasto ${codigo}`)

  return id
}

export const codigoEstadoGasto = async (id: number): Promise<CodigoEstadoGasto> => {
  const { porId } = await cargarEstados()
  return porId.get(id) as CodigoEstadoGasto
}

export const registrarTrazabilidad = (
  datos: {
    solicitudGastoId: number
    estadoAnteriorId: number | null
    estadoNuevoId: number
    usuarioId: number
    observacion?: string | null
  },
  transaction: Transaction
) => TrazabilidadGastos.create(datos, { transaction })

// Único punto por donde cambia el estado de un gasto:
// valida la transición, actualiza el gasto y deja la trazabilidad.
export const cambiarEstadoGasto = async (
  gasto: SolicitudesGasto,
  nuevo: CodigoEstadoGasto,
  usuarioId: number,
  transaction: Transaction,
  opciones: { observacion?: string | null, cambios?: Partial<SolicitudesGasto> } = {}
) => {
  const actual = await codigoEstadoGasto(gasto.estadoId)

  if (!TRANSICIONES[actual]?.includes(nuevo)) {
    throw new ErrorGastos(`El gasto ${gasto.codigo} está ${actual} y no puede pasar a ${nuevo}`)
  }

  const estadoAnteriorId = gasto.estadoId
  const estadoNuevoId = await idEstadoGasto(nuevo)

  await gasto.update(
    { ...opciones.cambios, estadoId: estadoNuevoId, actualizadoPor: usuarioId },
    { transaction }
  )

  await registrarTrazabilidad({
    solicitudGastoId: gasto.id,
    estadoAnteriorId,
    estadoNuevoId,
    usuarioId,
    observacion: opciones.observacion
  }, transaction)
}

