import { Op, col, fn, type Transaction } from 'sequelize'
import Bolsas from '../../models/gastos/bolsas'
import MovimientosBolsa from '../../models/gastos/movimientosBolsa'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import Anticipos from '../../models/gastos/anticipos'
import { llevaSaldoPorCliente, TIPOS_BOLSA, TIPOS_MOVIMIENTO_BOLSA, TipoMovimientoBolsa } from './constantes'
import { ErrorGastos } from './errores'
import { formatoMoneda } from './formato'

export type Movimiento = {
  tipo: TipoMovimientoBolsa
  valor: number                 // positivo entra, negativo sale
  solicitudGastoId?: number | null
  lotePagoId?: number | null
  cuentaCobroId?: number | null
  reintegroId?: number | null
  // Bolsas de anticipos: cliente dueño del dinero. Si no se indica, sale del anticipo o
  // del gasto (su anticipo); un movimiento sin cliente no se acepta en esas bolsas
  clienteId?: number | null
  anticipoId?: number | null
  observacion?: string | null
}

const aCentavos = (valor: number | string) => Math.round(Number(valor) * 100)

// En una bolsa de anticipos cada movimiento queda a nombre del cliente dueño del dinero
// (así su saldo es la suma de sus movimientos). Lo toma del anticipo o del gasto.
const conCliente = async (movimientos: Movimiento[], transaction: Transaction) => {
  const gastoIds = movimientos.filter(m => !m.clienteId && !m.anticipoId && m.solicitudGastoId).map(m => m.solicitudGastoId!)
  const gastos = gastoIds.length
    ? await SolicitudesGasto.findAll({ where: { id: { [Op.in]: gastoIds } }, attributes: ['id', 'codigo', 'anticipoId'], transaction })
    : []

  const anticipoIds = [...new Set([
    ...movimientos.map(m => m.anticipoId),
    ...gastos.map(g => g.anticipoId)
  ].filter(Boolean))] as number[]
  const anticipos = anticipoIds.length
    ? await Anticipos.findAll({ where: { id: { [Op.in]: anticipoIds } }, attributes: ['id', 'clienteId'], transaction })
    : []

  return movimientos.map(movimiento => {
    if (movimiento.clienteId) return movimiento
    const gasto = gastos.find(g => g.id === movimiento.solicitudGastoId)
    const anticipoId = movimiento.anticipoId ?? gasto?.anticipoId ?? null
    const clienteId = anticipos.find(a => a.id === anticipoId)?.clienteId
    if (!clienteId) {
      throw new ErrorGastos(gasto
        ? `El gasto ${gasto.codigo} no salió de un anticipo: no se puede pagar desde una bolsa de anticipos`
        : 'En una bolsa de anticipos cada movimiento debe ser de un cliente')
    }
    return { ...movimiento, anticipoId, clienteId }
  })
}

// El gasto de un anticipo solo se paga desde la bolsa de su anticipo, y una bolsa de anticipos
// solo paga gastos de anticipos (si no, se gastaría el dinero de un cliente en otro gasto).
// La de anticipos facturados no paga ningún gasto.
export const validarBolsaDelGasto = (gasto: SolicitudesGasto, bolsa: Bolsas) => {
  if (bolsa.tipo === TIPOS_BOLSA.FACTURAS) {
    throw new ErrorGastos(`La bolsa ${bolsa.nombre} es de anticipos facturados: no paga gastos`)
  }
  // Las cajas menores pagan en Tesorería → Caja menor (efectivo), no en lotes
  if (bolsa.tipo === TIPOS_BOLSA.CAJA_MENOR) {
    throw new ErrorGastos(`${bolsa.nombre} es una caja menor: ${gasto.codigo} se paga en Tesorería → Caja menor`)
  }
  if (gasto.anticipoId && gasto.bolsaId !== bolsa.id) {
    throw new ErrorGastos(`El gasto ${gasto.codigo} salió de un anticipo: solo se paga desde la bolsa de ese anticipo`)
  }
  if (!gasto.anticipoId && bolsa.tipo === TIPOS_BOLSA.ANTICIPOS) {
    throw new ErrorGastos(`La bolsa ${bolsa.nombre} es de anticipos: no puede pagar el gasto ${gasto.codigo}, que no salió de un anticipo`)
  }
  if (bolsa.sinSaldo && gasto.reembolsable) {
    throw new ErrorGastos(`La bolsa ${bolsa.nombre} es de no reembolsables: ${gasto.codigo} es reembolsable`)
  }
}

// Total pagado desde cada bolsa (pagos menos reintegros): es lo que muestran las bolsas sin saldo
// en lugar del saldo, que no sirve porque no se recargan
export const totalPagadoPorBolsa = async (bolsaIds: number[]) => {
  if (!bolsaIds.length) return new Map<number, number>()
  const filas = await MovimientosBolsa.findAll({
    where: { bolsaId: { [Op.in]: bolsaIds }, tipo: { [Op.in]: [TIPOS_MOVIMIENTO_BOLSA.PAGO, TIPOS_MOVIMIENTO_BOLSA.REINTEGRO] } },
    attributes: ['bolsaId', [fn('SUM', col('valor')), 'total']],
    group: ['bolsaId'],
    raw: true
  }) as unknown as { bolsaId: number, total: string }[]
  return new Map(filas.map(f => [f.bolsaId, -Number(f.total)]))
}

// Un gasto de caja menor solo se paga en efectivo desde su caja (Tesorería → Caja menor):
// ni se programa en un lote ni se paga directo desde otra bolsa
export const validarQueNoSeaDeCaja = async (gastos: SolicitudesGasto[], transaction?: Transaction) => {
  const cajas = (await Bolsas.findAll({ where: { tipo: TIPOS_BOLSA.CAJA_MENOR }, attributes: ['id'], transaction })).map(b => b.id)
  const deCaja = gastos.filter(g => cajas.includes(g.bolsaId))
  if (deCaja.length) {
    throw new ErrorGastos(`${deCaja.map(g => g.codigo).join(', ')} se paga${deCaja.length > 1 ? 'n' : ''} por caja menor (Tesorería → Caja menor)`)
  }
}

// Único punto por donde cambia el saldo de una bolsa.
// Bloquea la fila de la bolsa (SELECT … FOR UPDATE) para que dos pagos
// simultáneos no descuadren el saldo, registra cada movimiento con el saldo
// resultante y actualiza saldoActual. Debe llamarse dentro de una transacción.
// En las bolsas de anticipos además deja cada movimiento a nombre de su cliente.
export const registrarMovimientos = async (
  bolsaId: number,
  movimientos: Movimiento[],
  usuarioId: number,
  transaction: Transaction
) => {
  const bolsa = await Bolsas.findByPk(bolsaId, { transaction, lock: transaction.LOCK.UPDATE })

  if (!bolsa) throw new ErrorGastos('La bolsa no existe', 404)

  const saldoInicial = aCentavos(bolsa.saldoActual)
  const totalMovimientos = movimientos.reduce((suma, m) => suma + aCentavos(m.valor), 0)

  // Una bolsa nunca puede quedar en negativo, salvo las sin saldo (pagan sin tener dinero)
  if (!bolsa.sinSaldo && saldoInicial + totalMovimientos < 0) {
    throw new ErrorGastos(
      `Saldo insuficiente en la bolsa ${bolsa.nombre}: disponible ${formatoMoneda(saldoInicial / 100)}, ` +
      `requerido ${formatoMoneda(-totalMovimientos / 100)}`
    )
  }

  // En las bolsas generales no se lleva saldo por cliente
  const porCliente = llevaSaldoPorCliente(bolsa.tipo)
    ? await conCliente(movimientos, transaction)
    : movimientos.map(m => ({ ...m, clienteId: null }))

  let saldo = saldoInicial

  const registros = porCliente.map(movimiento => {
    saldo += aCentavos(movimiento.valor)

    return {
      ...movimiento,
      bolsaId,
      usuarioId,
      valor: String(aCentavos(movimiento.valor) / 100),
      saldoResultante: String(saldo / 100)
    }
  })

  await MovimientosBolsa.bulkCreate(registros, { transaction })
  await bolsa.update({ saldoActual: String(saldo / 100) }, { transaction })

  return { bolsa, saldoFinal: saldo / 100 }
}
