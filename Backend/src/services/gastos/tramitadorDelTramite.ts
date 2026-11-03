import type { Transaction } from 'sequelize'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import Tramitador from '../../models/tramitador'
import { ESTADOS_GASTO } from './constantes'
import { idEstadoGasto, registrarTrazabilidad } from './estadosGasto'

// Antes del pago el tramitador del gasto sigue al del trámite (decisión del usuario, 2026-11-03).
// Ya pagado solo se llena si estaba vacío: el dinero lo recibió el anterior y cambiarlo
// descuadraría reintegros y cuentas de cobro.
const SIN_PAGAR = [ESTADOS_GASTO.SOLICITADO, ESTADOS_GASTO.PROGRAMADO, ESTADOS_GASTO.APROBADO_PAGO] as const

// Lo llama el hook del trámite cada vez que le cambian el tramitador, venga de donde venga.
// `usuarioId` es quien hizo el cambio: sin él no queda la nota en el historial del gasto
export const pasarTramitadorAGastos = async (
  solicitudTramiteId: number,
  tramitadorId: number,
  usuarioId: number | null,
  transaction: Transaction | null
) => {
  const gastos = await SolicitudesGasto.findAll({
    where: { solicitudTramiteId },
    attributes: ['id', 'tramitadorId', 'estadoId'],
    transaction
  })
  if (!gastos.length) return

  const sinPagar = await Promise.all(SIN_PAGAR.map(idEstadoGasto))
  const anulado = await idEstadoGasto(ESTADOS_GASTO.ANULADO)
  const porCambiar = gastos.filter(g =>
    Number(g.tramitadorId) !== tramitadorId && g.estadoId !== anulado &&
    (!g.tramitadorId || sinPagar.includes(g.estadoId)))
  if (!porCambiar.length) return

  const ids = [...new Set([tramitadorId, ...porCambiar.map(g => g.tramitadorId).filter(Boolean)])]
  const tramitadores = await Tramitador.findAll({ where: { id: ids }, attributes: ['id', 'nombreTramitador'], transaction })
  const nombre = (id: number) => tramitadores.find(t => t.id === id)?.nombreTramitador ?? `#${id}`

  for (const gasto of porCambiar) {
    const anterior = gasto.tramitadorId
    await gasto.update({ tramitadorId }, { transaction })
    if (!usuarioId) continue
    // Queda en el historial sin cambiar de estado
    await registrarTrazabilidad({
      solicitudGastoId: gasto.id,
      estadoAnteriorId: gasto.estadoId,
      estadoNuevoId: gasto.estadoId,
      usuarioId,
      observacion: anterior
        ? `Tramitador cambiado de ${nombre(anterior)} a ${nombre(tramitadorId)} desde el trámite #${solicitudTramiteId}`
        : `Tramitador ${nombre(tramitadorId)} asignado desde el trámite #${solicitudTramiteId}`
    }, transaction as Transaction)
  }
}
