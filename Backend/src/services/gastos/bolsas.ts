import type { Transaction } from 'sequelize'
import Bolsas from '../../models/gastos/bolsas'
import MovimientosBolsa from '../../models/gastos/movimientosBolsa'
import { TipoMovimientoBolsa } from './constantes'
import { ErrorGastos } from './errores'
import { formatoMoneda } from './formato'

export type Movimiento = {
  tipo: TipoMovimientoBolsa
  valor: number                 // positivo entra, negativo sale
  solicitudGastoId?: number | null
  lotePagoId?: number | null
  cuentaCobroId?: number | null
  reintegroId?: number | null
  observacion?: string | null
}

const aCentavos = (valor: number | string) => Math.round(Number(valor) * 100)

// Único punto por donde cambia el saldo de una bolsa.
// Bloquea la fila de la bolsa (SELECT … FOR UPDATE) para que dos pagos
// simultáneos no descuadren el saldo, registra cada movimiento con el saldo
// resultante y actualiza saldoActual. Debe llamarse dentro de una transacción.
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

  let saldo = saldoInicial

  const registros = movimientos.map(movimiento => {
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
