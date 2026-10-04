import { Op } from 'sequelize'
import { db } from '../../config/db'
import Bolsas from '../../models/gastos/bolsas'
import LotesPago from '../../models/gastos/lotesPago'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import { registrarMovimientos } from './bolsas'
import { cambiarEstadoGasto, codigoEstadoGasto } from './estadosGasto'
import { ESTADOS_GASTO, TIPOS_MOVIMIENTO_BOLSA } from './constantes'
import { ErrorGastos } from './errores'

export type DatosPago = {
  bolsaId: number
  fechaPago: string            // YYYY-MM-DD
  numeroEgreso?: string | null
  observacion?: string | null
  // Valor pagado de cada gasto (en el frontend viene precargado con el valor solicitado)
  gastos: { id: number, valorRealmentePagado: number }[]
}

const redondear = (valor: number) => Math.round(valor * 100) / 100

// Paga uno o varios gastos en un lote, en una sola transacción:
// si cualquier gasto falla (estado, saldo, ...) no se paga ninguno.
export const pagarGastos = (datos: DatosPago, usuarioId: number) =>
  db.transaction(async transaction => {

    const ids = datos.gastos.map(g => g.id)

    if (new Set(ids).size !== ids.length) {
      throw new ErrorGastos('Hay gastos repetidos en el pago')
    }

    const bolsa = await Bolsas.findByPk(datos.bolsaId, { transaction })
    if (!bolsa?.activo) throw new ErrorGastos('La bolsa no existe o está inactiva')

    // Se bloquean los gastos para que nadie más los pague al mismo tiempo
    const gastos = await SolicitudesGasto.findAll({
      where: { id: { [Op.in]: ids } },
      transaction,
      lock: transaction.LOCK.UPDATE
    })

    if (gastos.length !== ids.length) throw new ErrorGastos('Uno o más gastos no existen')

    for (const gasto of gastos) {
      if (await codigoEstadoGasto(gasto.estadoId) !== ESTADOS_GASTO.SOLICITADO) {
        throw new ErrorGastos(`El gasto ${gasto.codigo} ya no está pendiente de pago`)
      }
    }

    const porId = new Map(gastos.map(g => [g.id, g]))
    const pagos = datos.gastos.map(pago => ({
      gasto: porId.get(pago.id)!,
      valorRealmentePagado: redondear(Number(pago.valorRealmentePagado))
    }))

    const total = redondear(pagos.reduce((suma, p) => suma + p.valorRealmentePagado, 0))

    const lote = await LotesPago.create({
      bolsaId: bolsa.id,
      fechaPago: datos.fechaPago,
      numeroEgreso: datos.numeroEgreso || null,
      total: String(total),
      creadoPor: usuarioId,
      observacion: datos.observacion || null
    }, { transaction })

    // Descuenta la bolsa (valida saldo suficiente) con un movimiento por gasto
    await registrarMovimientos(
      bolsa.id,
      pagos.map(p => ({
        tipo: TIPOS_MOVIMIENTO_BOLSA.PAGO,
        valor: -p.valorRealmentePagado,
        solicitudGastoId: p.gasto.id,
        lotePagoId: lote.id,
        observacion: `Pago ${p.gasto.codigo}`
      })),
      usuarioId,
      transaction
    )

    for (const pago of pagos) {
      const cambioBolsa = pago.gasto.bolsaId && pago.gasto.bolsaId !== bolsa.id

      await cambiarEstadoGasto(pago.gasto, ESTADOS_GASTO.PAGADO, usuarioId, transaction, {
        observacion: `Pagado en el lote #${lote.id}${cambioBolsa ? ` (bolsa cambiada a ${bolsa.nombre})` : ''}`,
        cambios: {
          bolsaId: bolsa.id,
          lotePagoId: lote.id,
          fechaPago: datos.fechaPago,
          numeroEgreso: datos.numeroEgreso || null,
          valorRealmentePagado: String(pago.valorRealmentePagado)
        }
      })
    }

    return lote
  })
