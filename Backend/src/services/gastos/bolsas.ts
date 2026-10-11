import { Op, type Transaction } from 'sequelize'
import Bolsas from '../../models/gastos/bolsas'
import MovimientosBolsa from '../../models/gastos/movimientosBolsa'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import Anticipos from '../../models/gastos/anticipos'
import { llevaSaldoPorCliente, TIPOS_BOLSA, TipoMovimientoBolsa } from './constantes'
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
  if (gasto.anticipoId && gasto.bolsaId !== bolsa.id) {
    throw new ErrorGastos(`El gasto ${gasto.codigo} salió de un anticipo: solo se paga desde la bolsa de ese anticipo`)
  }
  if (!gasto.anticipoId && bolsa.tipo === TIPOS_BOLSA.ANTICIPOS) {
    throw new ErrorGastos(`La bolsa ${bolsa.nombre} es de anticipos: no puede pagar el gasto ${gasto.codigo}, que no salió de un anticipo`)
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

  // Por ahora una bolsa nunca puede quedar en negativo
  if (saldoInicial + totalMovimientos < 0) {
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
