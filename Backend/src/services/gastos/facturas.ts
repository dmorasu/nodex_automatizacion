import { db } from '../../config/db'
import FacturasGasto from '../../models/gastos/facturasGasto'
import Reintegros from '../../models/gastos/reintegros'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import { calcularLegalizacion } from './calculos'
import { cambiarEstadoGasto, codigoEstadoGasto, registrarTrazabilidad } from './estadosGasto'
import { estadosReintegro } from './reintegros'
import { obtenerParametro } from './parametros'
import { ESTADOS_GASTO, ESTADOS_REINTEGRO, PARAMETROS } from './constantes'
import { ErrorGastos } from './errores'
import { formatoMoneda } from './formato'

export type DatosFactura = {
  numeroFactura?: string | null
  tieneFacturaReal: boolean
  identificacionTerceroReal?: string | null
  nombreTerceroReal?: string | null
  valorFactura: number
  observacion?: string | null
}

const aCentavos = (valor: number | string | null) => Math.round(Number(valor ?? 0) * 100)
const texto = (valor: unknown) => String(valor ?? '').trim() || null

// La retención ya no se calcula en Legalización: se define al crear el gasto (solo inmuebles).
// La factura guarda una copia para los reportes. Las facturas registradas antes del cambio
// (gasto sin retención) conservan la que tenían.
const retencionDeLaFactura = (gasto: SolicitudesGasto, existente: FacturasGasto | null) => {
  if (gasto.retencionBase !== null && gasto.retencionBase !== undefined) {
    return {
      baseRetencion: gasto.retencionBase,
      porcentajeRetencion: gasto.retencionPorcentaje,
      retencionFuente: gasto.retencionValor,
      totalPagar: gasto.retencionTotalPagar
    }
  }
  if (existente) {
    return {
      baseRetencion: existente.baseRetencion,
      porcentajeRetencion: existente.porcentajeRetencion,
      retencionFuente: existente.retencionFuente,
      totalPagar: existente.totalPagar
    }
  }
  return { baseRetencion: '0', porcentajeRetencion: '0', retencionFuente: '0', totalPagar: '0' }
}

// Registra (o corrige) la factura real de un gasto pagado:
// · calcula el 4x1000 y el valor a legalizar (la retención viene del gasto)
// · crea el reintegro pendiente por la diferencia (pagado − factura)
// · reembolsable: pasa a FACTURADO y queda listo para una cuenta de cobro
// · no reembolsable: pasa a FACTURADO y de inmediato a LEGALIZADO (lo asume la bolsa,
//   no va a cuenta de cobro); queda pendiente de que Contabilidad lo contabilice
export const registrarFactura = (gastoId: number, datos: DatosFactura, usuarioId: number) =>
  db.transaction(async transaction => {
    const gasto = await SolicitudesGasto.findByPk(gastoId, { transaction, lock: transaction.LOCK.UPDATE })
    if (!gasto) throw new ErrorGastos('El gasto no existe', 404)

    const estado = await codigoEstadoGasto(gasto.estadoId)
    // Un no reembolsable legalizado (aún sin contabilizar) puede corregir su factura
    const corrigeNoReembolsable = !gasto.reembolsable && estado === ESTADOS_GASTO.LEGALIZADO
    if (estado !== ESTADOS_GASTO.PAGADO && estado !== ESTADOS_GASTO.FACTURADO && !corrigeNoReembolsable) {
      throw new ErrorGastos(
        estado === ESTADOS_GASTO.EN_CUENTA_COBRO
          ? `El gasto ${gasto.codigo} está en una cuenta de cobro; sáquelo de la cuenta para corregir la factura`
          : `El gasto ${gasto.codigo} no está pagado; no se puede registrar la factura`
      )
    }

    const reintegros = await Reintegros.findAll({ where: { solicitudGastoId: gasto.id }, transaction })
    const idPendiente = await estadosReintegro.id(ESTADOS_REINTEGRO.PENDIENTE)
    const yaReintegrado = reintegros.filter(r => r.estadoId !== idPendiente)

    // Si el tramitador ya devolvió dinero, la factura no se puede cambiar sin descuadrar
    if (yaReintegrado.length > 0) {
      throw new ErrorGastos(`El gasto ${gasto.codigo} ya tiene un reintegro recibido; la factura no se puede modificar`)
    }

    const valorFactura = Number(datos.valorFactura)
    if (!(valorFactura > 0)) throw new ErrorGastos('El valor de la factura debe ser mayor a cero')

    const tasaGmf = await obtenerParametro(PARAMETROS.GMF)
    const { cuatroXMil, valorLegalizado } = calcularLegalizacion(valorFactura, tasaGmf)
    const existente = await FacturasGasto.findOne({ where: { solicitudGastoId: gasto.id }, transaction })

    const campos = {
      numeroFactura: texto(datos.numeroFactura),
      tieneFacturaReal: Boolean(datos.tieneFacturaReal),
      identificacionTerceroReal: texto(datos.identificacionTerceroReal),
      nombreTerceroReal: texto(datos.nombreTerceroReal),
      valorFactura: String(aCentavos(valorFactura) / 100),
      ...retencionDeLaFactura(gasto, existente),
      tasaGmf: String(tasaGmf),
      cuatroXMil: String(cuatroXMil),
      valorLegalizado: String(valorLegalizado),
      registradoPor: usuarioId,
      observacion: texto(datos.observacion)
    }

    if (existente) await existente.update(campos, { transaction })
    else await FacturasGasto.create({ ...campos, solicitudGastoId: gasto.id }, { transaction })

    // Reintegro = lo pagado − la factura. Se recalcula cada vez que se corrige la factura.
    await Reintegros.destroy({ where: { solicitudGastoId: gasto.id, estadoId: idPendiente }, transaction })

    const diferencia = (aCentavos(gasto.valorRealmentePagado) - aCentavos(valorFactura)) / 100
    let nota = `Factura ${campos.numeroFactura ?? 'sin número'} por ${formatoMoneda(valorFactura)}`

    if (diferencia > 0) {
      await Reintegros.create({
        solicitudGastoId: gasto.id,
        estadoId: idPendiente,
        valorReintegro: String(diferencia),
        registradoPor: usuarioId,
        observacion: `Diferencia entre lo pagado (${formatoMoneda(gasto.valorRealmentePagado)}) y la factura (${formatoMoneda(valorFactura)})`
      }, { transaction })
      nota += ` · reintegro pendiente de ${formatoMoneda(diferencia)}`
    } else if (diferencia < 0) {
      nota += ` · la factura supera lo pagado en ${formatoMoneda(-diferencia)}`
    }

    if (campos.numeroFactura) await gasto.update({ numeroFactura: campos.numeroFactura }, { transaction })

    const notaLegalizacion = `No reembolsable: legalizado con la factura ${campos.numeroFactura ?? 'sin número'} (gasto asumido por la bolsa)`

    if (estado === ESTADOS_GASTO.PAGADO) {
      await cambiarEstadoGasto(gasto, ESTADOS_GASTO.FACTURADO, usuarioId, transaction, { observacion: nota })

      if (!gasto.reembolsable) {
        await cambiarEstadoGasto(gasto, ESTADOS_GASTO.LEGALIZADO, usuarioId, transaction, {
          observacion: notaLegalizacion,
          cambios: { observacionLegalizacion: notaLegalizacion }
        })
      }
    } else {
      // Corrección de una factura ya registrada: queda en el historial sin cambiar de estado
      if (corrigeNoReembolsable) await gasto.update({ observacionLegalizacion: notaLegalizacion }, { transaction })

      await registrarTrazabilidad({
        solicitudGastoId: gasto.id,
        estadoAnteriorId: gasto.estadoId,
        estadoNuevoId: gasto.estadoId,
        usuarioId,
        observacion: `Factura corregida: ${nota}`
      }, transaction)

      if (!gasto.reembolsable && estado === ESTADOS_GASTO.FACTURADO) {
        await cambiarEstadoGasto(gasto, ESTADOS_GASTO.LEGALIZADO, usuarioId, transaction, {
          observacion: notaLegalizacion,
          cambios: { observacionLegalizacion: notaLegalizacion }
        })
      }
    }

    return { diferencia }
  })
