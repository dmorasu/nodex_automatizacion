import type { Transaction } from 'sequelize'
import { db } from '../../config/db'
import Reintegros from '../../models/gastos/reintegros'
import EstadosReintegro from '../../models/gastos/estadosReintegro'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import { catalogoEnMemoria } from './catalogoEnMemoria'
import { registrarMovimientos } from './bolsas'
import { ESTADOS_REINTEGRO, TIPOS_MOVIMIENTO_BOLSA } from './constantes'
import { ErrorGastos } from './errores'

type CodigoEstadoReintegro = typeof ESTADOS_REINTEGRO[keyof typeof ESTADOS_REINTEGRO]

export const estadosReintegro = catalogoEnMemoria<CodigoEstadoReintegro>(EstadosReintegro)

// Los reintegros se crean solos al registrar la factura (pagado − factura).
// Aquí solo se marcan como recibidos: el dinero vuelve a la bolsa del gasto.
// Dentro de una transacción existente (ej: al aprobar el soporte que sube el tramitador)
export const marcarReintegradoEn = async (
  transaction: Transaction, reintegroId: number, fechaReintegro: string, usuarioId: number
) => {
  const reintegro = await Reintegros.findByPk(reintegroId, { transaction, lock: transaction.LOCK.UPDATE })
  if (!reintegro) throw new ErrorGastos('El reintegro no existe', 404)

  if (await estadosReintegro.codigo(reintegro.estadoId) !== ESTADOS_REINTEGRO.PENDIENTE) {
    throw new ErrorGastos('Este reintegro ya fue marcado como reintegrado')
  }

  const gasto = await SolicitudesGasto.findByPk(reintegro.solicitudGastoId, { transaction })

  await registrarMovimientos(gasto.bolsaId, [{
    tipo: TIPOS_MOVIMIENTO_BOLSA.REINTEGRO,
    valor: Number(reintegro.valorReintegro),
    solicitudGastoId: gasto.id,
    reintegroId: reintegro.id,
    observacion: `Reintegro ${gasto.codigo}`
  }], usuarioId, transaction)

  await reintegro.update({
    estadoId: await estadosReintegro.id(ESTADOS_REINTEGRO.REINTEGRADO),
    fechaReintegro
  }, { transaction })
}

export const marcarReintegrado = (reintegroId: number, fechaReintegro: string, usuarioId: number) =>
  db.transaction(transaction => marcarReintegradoEn(transaction, reintegroId, fechaReintegro, usuarioId))
