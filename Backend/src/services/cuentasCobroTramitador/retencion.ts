import { Op, type Transaction } from 'sequelize'
import CuentaCobroTramitador, {
  ESTADOS_CUENTA_TRAMITADOR as ESTADOS,
  type CalculoRetencion
} from '../../models/cuentasCobroTramitador/cuentaCobroTramitador'
import { obtenerParametro } from '../gastos/parametros'
import { PARAMETROS } from '../gastos/constantes'

// =====================================
// RETENCIÓN DE LAS CUENTAS DE COBRO DE LOS TRAMITADORES (fase 2, 2026-10-27)
// Decisiones del usuario: la calcula Nodex al llegar a Tesorería y Tesorería la puede ajustar con
// un motivo; contabilidad aplica después lo que falte (renta exenta del 25 %, aportes, etc.).
//  · Con la declaración del art. 383 firmada: tabla del art. 383 sobre lo acumulado del
//    tramitador en el mes de radicación, menos lo ya retenido en sus otras cuentas de ese mes.
//  · Sin la declaración: tarifa fija (parámetro RETENCION_TRAMITADORES, 10 %).
// La UVT es un parámetro que se actualiza cada enero. Dinero en centavos.
// =====================================

// Tabla del art. 383 del Estatuto Tributario, en UVT: [desde, tarifa, UVT que se suman]
const TABLA_383: [number, number, number][] = [
  [2300, 0.39, 770],
  [945, 0.37, 268],
  [640, 0.35, 162],
  [360, 0.33, 69],
  [150, 0.28, 10],
  [95, 0.19, 0]
]

// Retención en UVT para un pago mensual de `base` UVT
export const retencionTabla383 = (base: number) => {
  const rango = TABLA_383.find(([desde]) => base > desde)
  return rango ? (base - rango[0]) * rango[1] + rango[2] : 0
}

// '2026-12' → '2027-01-01'
const primerDiaMesSiguiente = (mes: string) => {
  const [anio, numero] = mes.split('-').map(Number)
  return numero === 12 ? `${anio + 1}-01-01` : `${anio}-${String(numero + 1).padStart(2, '0')}-01`
}

// Centavos redondeados al peso
const alPeso = (centavos: number) => Math.round(centavos / 100) * 100

// Retención que propone Nodex para una cuenta que ya tiene fecha de radicación
export const calcularRetencion = async (cuenta: CuentaCobroTramitador, transaction?: Transaction): Promise<CalculoRetencion> => {
  const mes = (cuenta.fechaRadicacion ?? '').slice(0, 7)
  const uvt = await obtenerParametro(PARAMETROS.UVT)
  const total = Number(cuenta.total)

  if (cuenta.datosTramitador?.declaracionArt383 === false) {
    const tarifa = await obtenerParametro(PARAMETROS.RETENCION_TRAMITADORES)
    return { metodo: 'TARIFA_FIJA', mes, uvt, tarifa, calculada: alPeso(total * tarifa) }
  }

  // Sus otras cuentas radicadas en el mismo mes (las anuladas ya no cuentan)
  const otras = await CuentaCobroTramitador.findAll({
    where: {
      tramitadorId: cuenta.tramitadorId,
      id: { [Op.ne]: cuenta.id },
      estado: [ESTADOS.EN_TESORERIA, ESTADOS.PAGADA],
      fechaRadicacion: { [Op.gte]: `${mes}-01`, [Op.lt]: primerDiaMesSiguiente(mes) }
    },
    attributes: ['total', 'retencion'],
    transaction
  })
  const baseMes = otras.reduce((suma, c) => suma + Number(c.total), total)
  const retenidoAntes = otras.reduce((suma, c) => suma + Number(c.retencion ?? 0), 0)
  const retencionMes = alPeso(retencionTabla383(baseMes / 100 / uvt) * uvt * 100)

  return {
    metodo: 'TABLA_383',
    mes,
    uvt,
    baseMes,
    retencionMes,
    retenidoAntes,
    // Nunca más que el total de la cuenta ni negativa
    calculada: Math.min(total, Math.max(0, retencionMes - retenidoAntes))
  }
}

// Calcula y guarda la retención si la cuenta aún no la tiene (al dar el visto bueno, o al abrirla
// en Tesorería si llegó antes de esta fase)
export const asegurarRetencion = async (cuenta: CuentaCobroTramitador, transaction?: Transaction) => {
  if (cuenta.retencion !== null || !cuenta.fechaRadicacion) return cuenta
  const calculo = await calcularRetencion(cuenta, transaction)
  return cuenta.update({ retencion: String(calculo.calculada), calculoRetencion: calculo, retencionAjustada: false }, { transaction })
}
