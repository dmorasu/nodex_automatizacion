import { Op } from 'sequelize'
import { db } from '../../config/db'
import LotesPago from '../../models/gastos/lotesPago'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import CuentasCobro from '../../models/gastos/cuentasCobro'
import CuentasCobroGastos from '../../models/gastos/cuentasCobroGastos'
import Contabilizaciones from '../../models/gastos/contabilizaciones'
import TrazabilidadCuentasCobro from '../../models/gastos/trazabilidadCuentasCobro'
import { cambiarEstadoGasto, codigoEstadoGasto, registrarTrazabilidad } from './estadosGasto'
import { estadosCuenta } from './cuentasCobro'
import { ESTADOS_CUENTA_COBRO, ESTADOS_GASTO } from './constantes'
import { ErrorGastos } from './errores'

// Número de egreso contable de un pago de Tesorería (lote).
// Queda en el lote y en cada gasto del lote. Se puede corregir.
export const registrarEgreso = (loteId: number, numeroEgreso: string, usuarioId: number) =>
  db.transaction(async transaction => {
    const lote = await LotesPago.findByPk(loteId, { transaction, lock: transaction.LOCK.UPDATE })
    if (!lote) throw new ErrorGastos('El lote de pago no existe', 404)

    const numero = numeroEgreso.trim()
    const anterior = lote.numeroEgreso

    await lote.update({ numeroEgreso: numero }, { transaction })

    const gastos = await SolicitudesGasto.findAll({ where: { lotePagoId: lote.id }, transaction })

    for (const gasto of gastos) {
      await gasto.update({ numeroEgreso: numero, actualizadoPor: usuarioId }, { transaction })

      // Queda en el historial del gasto sin cambiar su estado
      await registrarTrazabilidad({
        solicitudGastoId: gasto.id,
        estadoAnteriorId: gasto.estadoId,
        estadoNuevoId: gasto.estadoId,
        usuarioId,
        observacion: anterior
          ? `Número de egreso corregido: ${anterior} → ${numero}`
          : `Número de egreso ${numero} registrado por Contabilidad`
      }, transaction)
    }

    return { gastos: gastos.length }
  })

export type GastoAContabilizar = { id: number, documentoContable: string }

// Contabiliza gastos NO reembolsables legalizados (no pasan por cuenta de cobro).
// Todo o nada: el documento queda en el gasto y el gasto pasa a CONTABILIZADO.
export const contabilizarGastos = (
  items: GastoAContabilizar[],
  fechaContabilizacion: string | null,
  usuarioId: number
) =>
  db.transaction(async transaction => {
    const ids = items.map(i => i.id)
    if (new Set(ids).size !== ids.length) throw new ErrorGastos('Hay gastos repetidos')

    const gastos = await SolicitudesGasto.findAll({
      where: { id: { [Op.in]: ids } },
      transaction,
      lock: transaction.LOCK.UPDATE
    })
    if (gastos.length !== ids.length) throw new ErrorGastos('Uno o más gastos no existen')

    const fecha = fechaContabilizacion ? new Date(`${fechaContabilizacion}T12:00:00`) : new Date()

    for (const { id, documentoContable } of items) {
      const gasto = gastos.find(g => g.id === id)!
      const documento = documentoContable?.trim()

      if (gasto.reembolsable) {
        throw new ErrorGastos(`El gasto ${gasto.codigo} es reembolsable: se contabiliza con su cuenta de cobro`)
      }
      if (await codigoEstadoGasto(gasto.estadoId) !== ESTADOS_GASTO.LEGALIZADO) {
        throw new ErrorGastos(`El gasto ${gasto.codigo} no está legalizado (registre primero su factura)`)
      }
      if (!documento) throw new ErrorGastos(`Falta el documento contable del gasto ${gasto.codigo}`)

      const enCuenta = await CuentasCobroGastos.count({
        where: { solicitudGastoId: gasto.id },
        include: [{ model: CuentasCobro, required: true, where: { estadoId: { [Op.ne]: await estadosCuenta.id(ESTADOS_CUENTA_COBRO.ANULADA) } } }],
        transaction
      })
      if (enCuenta) {
        throw new ErrorGastos(`El gasto ${gasto.codigo} está en una cuenta de cobro: se contabiliza con esa cuenta`)
      }

      await cambiarEstadoGasto(gasto, ESTADOS_GASTO.CONTABILIZADO, usuarioId, transaction, {
        observacion: `Contabilizado con documento ${documento} (no reembolsable)`,
        cambios: { documentoContable: documento, fechaContabilizacion: fecha, contabilizadoPor: usuarioId }
      })
    }
  })

export type CuentaAContabilizar = { id: number, documentoContable: string }

// Contabiliza una o varias cuentas de cobro legalizadas. Todo o nada:
// · la contabilización queda Contabilizada con documento, fecha y usuario
// · la cuenta pasa a CONTABILIZADA y sus gastos a CONTABILIZADO
export const contabilizarCuentas = (
  cuentas: CuentaAContabilizar[],
  fechaContabilizacion: string | null,
  usuarioId: number
) =>
  db.transaction(async transaction => {
    const ids = cuentas.map(c => c.id)
    if (new Set(ids).size !== ids.length) throw new ErrorGastos('Hay cuentas de cobro repetidas')

    const registros = await CuentasCobro.findAll({
      where: { id: { [Op.in]: ids } },
      transaction,
      lock: transaction.LOCK.UPDATE
    })
    if (registros.length !== ids.length) throw new ErrorGastos('Una o más cuentas de cobro no existen')

    const legalizada = await estadosCuenta.id(ESTADOS_CUENTA_COBRO.LEGALIZADA)
    const contabilizada = await estadosCuenta.id(ESTADOS_CUENTA_COBRO.CONTABILIZADA)
    const fecha = fechaContabilizacion ? new Date(`${fechaContabilizacion}T12:00:00`) : new Date()

    for (const { id, documentoContable } of cuentas) {
      const cuenta = registros.find(c => c.id === id)!
      const documento = documentoContable?.trim()

      if (cuenta.estadoId !== legalizada) {
        throw new ErrorGastos(`La cuenta de cobro ${cuenta.numeroCuentaCobro} no está legalizada`)
      }
      if (!documento) {
        throw new ErrorGastos(`Falta el documento contable de la cuenta ${cuenta.numeroCuentaCobro}`)
      }

      // Se crea al legalizar; si faltara (datos antiguos) se crea aquí
      const [contabilizacion] = await Contabilizaciones.findOrCreate({
        where: { cuentaCobroId: cuenta.id },
        defaults: { cuentaCobroId: cuenta.id },
        transaction
      })

      await contabilizacion.update({
        contabilizado: true,
        documentoContable: documento,
        fechaContabilizacion: fecha,
        contabilizadoPor: usuarioId
      }, { transaction })

      const nota = `Contabilizado con documento ${documento} (cuenta de cobro ${cuenta.numeroCuentaCobro})`

      const lineas = await CuentasCobroGastos.findAll({ where: { cuentaCobroId: cuenta.id }, transaction })
      const gastos = await SolicitudesGasto.findAll({
        where: { id: { [Op.in]: lineas.map(l => l.solicitudGastoId) } },
        transaction,
        lock: transaction.LOCK.UPDATE
      })

      for (const gasto of gastos) {
        if (await codigoEstadoGasto(gasto.estadoId) === ESTADOS_GASTO.LEGALIZADO) {
          await cambiarEstadoGasto(gasto, ESTADOS_GASTO.CONTABILIZADO, usuarioId, transaction, { observacion: nota })
        }
      }

      const anterior = cuenta.estadoId
      await cuenta.update({ estadoId: contabilizada }, { transaction })
      await TrazabilidadCuentasCobro.create({
        cuentaCobroId: cuenta.id,
        estadoAnteriorId: anterior,
        estadoNuevoId: contabilizada,
        usuarioId,
        observacion: `Documento contable ${documento}`
      }, { transaction })
    }
  })
