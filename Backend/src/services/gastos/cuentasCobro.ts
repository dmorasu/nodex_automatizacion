import { Op, Transaction } from 'sequelize'
import { db } from '../../config/db'
import CuentasCobro from '../../models/gastos/cuentasCobro'
import CuentasCobroGastos from '../../models/gastos/cuentasCobroGastos'
import EstadosCuentaCobro from '../../models/gastos/estadosCuentaCobro'
import TrazabilidadCuentasCobro from '../../models/gastos/trazabilidadCuentasCobro'
import Contabilizaciones from '../../models/gastos/contabilizaciones'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import FacturasGasto from '../../models/gastos/facturasGasto'
import { catalogoEnMemoria } from './catalogoEnMemoria'
import { cambiarEstadoGasto, codigoEstadoGasto } from './estadosGasto'
import { registrarMovimientos } from './bolsas'
import { ESTADOS_CUENTA_COBRO, ESTADOS_GASTO, TIPOS_MOVIMIENTO_BOLSA } from './constantes'
import { ErrorGastos } from './errores'

type CodigoEstadoCuenta = typeof ESTADOS_CUENTA_COBRO[keyof typeof ESTADOS_CUENTA_COBRO]

export const estadosCuenta = catalogoEnMemoria<CodigoEstadoCuenta>(EstadosCuentaCobro)

export type DatosCuenta = {
  numeroCuentaCobro: string
  fechaRadicacion?: string | null
  observacion?: string | null
}

const aCentavos = (valor: number | string) => Math.round(Number(valor) * 100)
const texto = (valor: unknown) => String(valor ?? '').trim() || null


// =====================================
// UTILIDADES
// =====================================

const registrarTrazabilidad = async (
  cuenta: CuentasCobro,
  nuevo: CodigoEstadoCuenta,
  usuarioId: number,
  transaction: Transaction,
  observacion?: string | null
) => {
  const estadoAnteriorId = cuenta.estadoId
  const estadoNuevoId = await estadosCuenta.id(nuevo)

  await cuenta.update({ estadoId: estadoNuevoId }, { transaction })

  await TrazabilidadCuentasCobro.create({
    cuentaCobroId: cuenta.id,
    estadoAnteriorId,
    estadoNuevoId,
    usuarioId,
    observacion: observacion ?? null
  }, { transaction })
}

// Bloquea la cuenta y verifica que siga en Borrador (solo así se puede modificar)
const cuentaEnBorrador = async (cuentaId: number, transaction: Transaction) => {
  const cuenta = await CuentasCobro.findByPk(cuentaId, { transaction, lock: transaction.LOCK.UPDATE })

  if (!cuenta) throw new ErrorGastos('La cuenta de cobro no existe', 404)

  if (await estadosCuenta.codigo(cuenta.estadoId) !== ESTADOS_CUENTA_COBRO.BORRADOR) {
    throw new ErrorGastos(`La cuenta de cobro ${cuenta.numeroCuentaCobro} ya no está en borrador`)
  }

  return cuenta
}

const validarNumeroUnico = async (numero: string, transaction: Transaction, excluirId?: number) => {
  const existente = await CuentasCobro.findOne({
    where: { numeroCuentaCobro: numero, ...(excluirId && { id: { [Op.ne]: excluirId } }) },
    transaction
  })

  if (existente) throw new ErrorGastos(`Ya existe la cuenta de cobro ${numero}`, 409)
}

// Recalcula los totales de la cuenta a partir de sus líneas
const recalcularTotales = async (cuenta: CuentasCobro, transaction: Transaction) => {
  const lineas = await CuentasCobroGastos.findAll({ where: { cuentaCobroId: cuenta.id }, transaction })

  const sumar = (campo: 'valorFactura' | 'cuatroXMil' | 'valorLegalizado') =>
    String(lineas.reduce((suma, l) => suma + aCentavos(l[campo]), 0) / 100)

  await cuenta.update({
    totalFacturas: sumar('valorFactura'),
    totalCuatroXMil: sumar('cuatroXMil'),
    totalLegalizado: sumar('valorLegalizado')
  }, { transaction })
}

const obtenerLinea = async (cuentaId: number, lineaId: number, transaction: Transaction) => {
  const linea = await CuentasCobroGastos.findOne({ where: { id: lineaId, cuentaCobroId: cuentaId }, transaction })
  if (!linea) throw new ErrorGastos('El gasto no está en esta cuenta de cobro', 404)
  return linea
}


// =====================================
// OPERACIONES
// =====================================

export const crearCuenta = (datos: DatosCuenta, usuarioId: number) =>
  db.transaction(async transaction => {
    const numero = texto(datos.numeroCuentaCobro)!
    await validarNumeroUnico(numero, transaction)

    const cuenta = await CuentasCobro.create({
      numeroCuentaCobro: numero,
      estadoId: await estadosCuenta.id(ESTADOS_CUENTA_COBRO.BORRADOR),
      fechaRadicacion: datos.fechaRadicacion || null,
      observacion: texto(datos.observacion),
      creadoPor: usuarioId
    }, { transaction })

    await TrazabilidadCuentasCobro.create({
      cuentaCobroId: cuenta.id,
      estadoAnteriorId: null,
      estadoNuevoId: cuenta.estadoId,
      usuarioId,
      observacion: 'Cuenta de cobro creada'
    }, { transaction })

    return cuenta
  })

export const actualizarCuenta = (cuentaId: number, datos: DatosCuenta) =>
  db.transaction(async transaction => {
    const cuenta = await cuentaEnBorrador(cuentaId, transaction)
    const numero = texto(datos.numeroCuentaCobro)!

    await validarNumeroUnico(numero, transaction, cuenta.id)

    await cuenta.update({
      numeroCuentaCobro: numero,
      fechaRadicacion: datos.fechaRadicacion || null,
      observacion: texto(datos.observacion)
    }, { transaction })
  })

// Agrega gastos FACTURADOS. Cada línea guarda una copia de los valores de su
// factura, para que la cuenta conserve lo que se cobró aunque después cambie algo.
export const agregarGastos = (cuentaId: number, gastoIds: number[], usuarioId: number) =>
  db.transaction(async transaction => {
    const cuenta = await cuentaEnBorrador(cuentaId, transaction)

    const gastos = await SolicitudesGasto.findAll({
      where: { id: { [Op.in]: gastoIds } },
      include: [{ model: FacturasGasto }],
      transaction,
      lock: { level: transaction.LOCK.UPDATE, of: SolicitudesGasto }
    })

    if (gastos.length !== new Set(gastoIds).size) throw new ErrorGastos('Uno o más gastos no existen')

    for (const gasto of gastos) {
      if (!gasto.reembolsable) {
        throw new ErrorGastos(`El gasto ${gasto.codigo} no es reembolsable: no va a cuenta de cobro`)
      }
      if (await codigoEstadoGasto(gasto.estadoId) !== ESTADOS_GASTO.FACTURADO || !gasto.factura) {
        throw new ErrorGastos(`El gasto ${gasto.codigo} no tiene factura registrada o ya está en otra cuenta de cobro`)
      }
    }

    for (const gasto of gastos) {
      const { factura } = gasto

      await CuentasCobroGastos.create({
        cuentaCobroId: cuenta.id,
        solicitudGastoId: gasto.id,
        tieneFacturaReal: factura.tieneFacturaReal,
        valorFactura: factura.valorFactura,
        tasaGmf: factura.tasaGmf,
        cuatroXMil: factura.cuatroXMil,
        valorLegalizado: factura.valorLegalizado,
        identificacionTerceroReal: factura.identificacionTerceroReal,
        nombreTerceroReal: factura.nombreTerceroReal
      }, { transaction })

      await cambiarEstadoGasto(gasto, ESTADOS_GASTO.EN_CUENTA_COBRO, usuarioId, transaction, {
        observacion: `Agregado a la cuenta de cobro ${cuenta.numeroCuentaCobro}`
      })
    }

    await recalcularTotales(cuenta, transaction)
  })

// Saca el gasto de la cuenta: vuelve a Facturado y queda disponible para otra cuenta
export const quitarLinea = (cuentaId: number, lineaId: number, usuarioId: number) =>
  db.transaction(async transaction => {
    const cuenta = await cuentaEnBorrador(cuentaId, transaction)
    const linea = await obtenerLinea(cuenta.id, lineaId, transaction)
    const gasto = await SolicitudesGasto.findByPk(linea.solicitudGastoId, { transaction, lock: transaction.LOCK.UPDATE })

    await cambiarEstadoGasto(gasto, ESTADOS_GASTO.FACTURADO, usuarioId, transaction, {
      observacion: `Retirado de la cuenta de cobro ${cuenta.numeroCuentaCobro}`
    })

    await linea.destroy({ transaction })
    await recalcularTotales(cuenta, transaction)
  })

// Legaliza la cuenta: los gastos quedan Legalizados y el total de la cuenta vuelve
// a la bolsa en UN movimiento por bolsa que indica la cuenta de cobro. Se crea la
// contabilización pendiente. Todo o nada.
export const legalizarCuenta = (cuentaId: number, fechaRadicacion: string | null, usuarioId: number) =>
  db.transaction(async transaction => {
    const cuenta = await cuentaEnBorrador(cuentaId, transaction)

    const radicacion = fechaRadicacion || cuenta.fechaRadicacion
    if (!radicacion) throw new ErrorGastos('Indique la fecha de radicación de la cuenta de cobro')

    const lineas = await CuentasCobroGastos.findAll({ where: { cuentaCobroId: cuenta.id }, transaction })
    if (lineas.length === 0) throw new ErrorGastos('La cuenta de cobro no tiene gastos')

    const gastos = await SolicitudesGasto.findAll({
      where: { id: { [Op.in]: lineas.map(l => l.solicitudGastoId) } },
      transaction,
      lock: transaction.LOCK.UPDATE
    })

    const nota = `Legalizado con cuenta de cobro ${cuenta.numeroCuentaCobro}`
    // bolsaId → { centavos, gastos }
    const porBolsa = new Map<number, { centavos: number, gastos: number }>()

    for (const linea of lineas) {
      const gasto = gastos.find(g => g.id === linea.solicitudGastoId)!

      if (!gasto.bolsaId) throw new ErrorGastos(`El gasto ${gasto.codigo} no tiene bolsa asociada`)

      await cambiarEstadoGasto(gasto, ESTADOS_GASTO.LEGALIZADO, usuarioId, transaction, {
        observacion: nota,
        cambios: { observacionLegalizacion: nota }
      })

      const acumulado = porBolsa.get(gasto.bolsaId) ?? { centavos: 0, gastos: 0 }
      porBolsa.set(gasto.bolsaId, {
        centavos: acumulado.centavos + aCentavos(linea.valorLegalizado),
        gastos: acumulado.gastos + 1
      })
    }

    // El total de la cuenta de cobro vuelve a la bolsa (repartido si hay gastos de varias bolsas)
    for (const [bolsaId, { centavos, gastos: cantidad }] of porBolsa) {
      await registrarMovimientos(bolsaId, [{
        tipo: TIPOS_MOVIMIENTO_BOLSA.LEGALIZACION,
        valor: centavos / 100,
        cuentaCobroId: cuenta.id,
        observacion: `Cuenta de cobro ${cuenta.numeroCuentaCobro} · ${cantidad} gasto(s)`
      }], usuarioId, transaction)
    }

    await Contabilizaciones.create({ cuentaCobroId: cuenta.id }, { transaction })

    await cuenta.update({ fechaRadicacion: radicacion, fechaLegalizacion: new Date() }, { transaction })
    await registrarTrazabilidad(cuenta, ESTADOS_CUENTA_COBRO.LEGALIZADA, usuarioId, transaction, 'Cuenta de cobro legalizada')
  })

// Solo en borrador: los gastos vuelven a Facturado. Las líneas se conservan como historial.
export const anularCuenta = (cuentaId: number, motivo: string, usuarioId: number) =>
  db.transaction(async transaction => {
    const cuenta = await cuentaEnBorrador(cuentaId, transaction)
    const lineas = await CuentasCobroGastos.findAll({ where: { cuentaCobroId: cuenta.id }, transaction })

    const gastos = await SolicitudesGasto.findAll({
      where: { id: { [Op.in]: lineas.map(l => l.solicitudGastoId) } },
      transaction,
      lock: transaction.LOCK.UPDATE
    })

    for (const gasto of gastos) {
      await cambiarEstadoGasto(gasto, ESTADOS_GASTO.FACTURADO, usuarioId, transaction, {
        observacion: `Cuenta de cobro ${cuenta.numeroCuentaCobro} anulada`
      })
    }

    await cuenta.update({ motivoAnulacion: motivo }, { transaction })
    await registrarTrazabilidad(cuenta, ESTADOS_CUENTA_COBRO.ANULADA, usuarioId, transaction, motivo)
  })
