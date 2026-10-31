import { Op } from 'sequelize'
import { db } from '../../config/db'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import Bolsas from '../../models/gastos/bolsas'
import MovimientosBolsa from '../../models/gastos/movimientosBolsa'
import CuentasCobroGastos from '../../models/gastos/cuentasCobroGastos'
import CuentasCobro from '../../models/gastos/cuentasCobro'
import { prepararDatos, RETENCION_VACIA, type DatosGasto } from './solicitudesGasto'
import { codigoEstadoGasto, registrarTrazabilidad } from './estadosGasto'
import { registrarMovimientos, type Movimiento } from './bolsas'
import { ESTADOS_GASTO, TIPOS_MOVIMIENTO_BOLSA } from './constantes'
import { ErrorGastos } from './errores'

// =====================================
// EDICIÓN DEL ADMINISTRADOR DE GASTOS EN CUALQUIER ESTADO (2026-10-31)
// Decisión del usuario: solo el Administrador de Gastos, desde "Editar" en el detalle, en
// cualquier estado (menos Anulado), con motivo. En Solicitado se edita como siempre
// (actualizarGasto); aquí van los demás estados. No cambian el valor (para eso están "Corregir
// valor" y la corrección masiva), la forma de pago ni el anticipo.
//
// Cambio de bolsa, con el dinero:
//  · lo que la bolsa anterior movió por el gasto (pago, ajustes, reversos y reintegros, todos con
//    el gasto) se devuelve allí (REVERSO) y se registra en la nueva como PAGO, por el neto;
//  · si es reembolsable y su cuenta de cobro ya se legalizó, lo legalizado volvió a la bolsa
//    anterior: sale de ella (REVERSO) y entra a la nueva (LEGALIZACION), con la cuenta de cobro.
// No se cambia la bolsa con el gasto en un lote por pagar (el lote es de una bolsa: Tesorería lo
// quita del lote), en caja menor ya entregada, ni en gastos de anticipos (siempre la del anticipo).
// =====================================

const ESTADOS_EN_LOTE: string[] = [ESTADOS_GASTO.PROGRAMADO, ESTADOS_GASTO.APROBADO_PAGO]
const ESTADOS_CAJA: string[] = [ESTADOS_GASTO.PAGADO_CAJA, ESTADOS_GASTO.PENDIENTE_REEMBOLSO, ESTADOS_GASTO.EN_REEMBOLSO, ESTADOS_GASTO.LEGALIZADO_CAJA]
// Con la factura registrada, reembolsable decide si el gasto va a cuenta de cobro o a Contabilidad
const ESTADOS_CON_FACTURA: string[] = [ESTADOS_GASTO.FACTURADO, ESTADOS_GASTO.EN_CUENTA_COBRO, ESTADOS_GASTO.LEGALIZADO, ESTADOS_GASTO.CONTABILIZADO]

const aCentavos = (valor: unknown) => Math.round(Number(valor ?? 0) * 100)

// Campos que se comparan para el historial: texto (se muestra antes → después) o referencia (solo
// se nombra el campo; la bolsa se describe aparte con sus nombres)
const CAMPOS_TEXTO: [keyof SolicitudesGasto, string][] = [
  ['conceptoPago', 'concepto'], ['placa', 'placa'], ['transito', 'tránsito'], ['matriculaInmobiliaria', 'matrícula'],
  ['contrato', 'contrato'], ['codigoBpr', 'código BPR/FTF'], ['nombreClienteBanco', 'cliente'],
  ['identificacionClienteBanco', 'identificación del cliente'], ['numeroFactura', 'número de factura'], ['observacion', 'observación']
]
const CAMPOS_REFERENCIA: [keyof SolicitudesGasto, string][] = [
  ['operacionId', 'operación'], ['tipoGastoId', 'tipo de gasto'], ['beneficiarioId', 'beneficiario'],
  ['tramitadorId', 'tramitador'], ['solicitudTramiteId', 'trámite'], ['reembolsable', 'reembolsable'],
  ['valorLiquidacion', 'valor liquidación'], ['retencionBase', 'base de retención'], ['retencionPorcentaje', '% de retención']
]

// '1000.00' y 1000 son lo mismo; '' y null también
const normalizar = (valor: unknown) => {
  if (valor === null || valor === undefined || valor === '') return ''
  if (typeof valor === 'boolean' || typeof valor === 'number') return String(valor)
  const texto = String(valor).trim()
  return /^-?\d+(\.\d+)?$/.test(texto) ? String(Number(texto)) : texto
}

export const editarGastoComoAdmin = (gastoId: number, datos: DatosGasto, motivo: string, usuarioId: number) =>
  db.transaction(async transaction => {
    const gasto = await SolicitudesGasto.findByPk(gastoId, { transaction, lock: transaction.LOCK.UPDATE })
    if (!gasto) throw new ErrorGastos('El gasto no existe', 404)

    const estado = await codigoEstadoGasto(gasto.estadoId)
    if (estado === ESTADOS_GASTO.ANULADO) throw new ErrorGastos('Un gasto anulado no se edita')
    if (estado === ESTADOS_GASTO.SOLICITADO) throw new ErrorGastos('En Solicitado se edita con el formulario de siempre')
    const motivoLimpio = String(motivo ?? '').trim()
    if (motivoLimpio.length < 3) throw new ErrorGastos('Escriba el motivo de la corrección')

    // El valor, la forma de pago y el anticipo se conservan
    const campos = await prepararDatos({
      ...datos,
      anticipoId: gasto.anticipoId,
      formaPagoId: gasto.formaPagoId,
      valorSolicitado: Number(gasto.valorSolicitadoPago)
    }, transaction, false, gasto)
    delete (campos as Partial<typeof campos>).valorSolicitadoPago

    // Un inmueble viejo sin retención guardada no la gana por editarlo (el formulario manda los
    // valores por defecto): solo si cambia el tipo o se escribe una base o una liquidación
    if (gasto.retencionBase === null && campos.tipoGastoId === gasto.tipoGastoId && !Number(datos.baseRetencion) && !Number(datos.valorLiquidacion)) {
      Object.assign(campos, RETENCION_VACIA)
    }

    if (ESTADOS_CON_FACTURA.includes(estado) && campos.reembolsable !== gasto.reembolsable) {
      throw new ErrorGastos('Ya tiene la factura registrada: no se cambia si es reembolsable')
    }

    // ── Lo que cambia (para el historial) ──
    const cambios: string[] = []
    for (const [campo, etiqueta] of CAMPOS_TEXTO) {
      const antes = normalizar(gasto[campo])
      const despues = normalizar(campos[campo as keyof typeof campos])
      if (antes !== despues) cambios.push(`${etiqueta}: ${antes || '(vacío)'} → ${despues || '(vacío)'}`)
    }
    for (const [campo, etiqueta] of CAMPOS_REFERENCIA) {
      if (normalizar(gasto[campo]) !== normalizar(campos[campo as keyof typeof campos])) cambios.push(etiqueta)
    }

    // ── Bolsa ──
    const cambiaBolsa = campos.bolsaId !== gasto.bolsaId
    if (cambiaBolsa) {
      if (ESTADOS_EN_LOTE.includes(estado)) {
        throw new ErrorGastos(`Está en el lote #${gasto.lotePagoId} por pagar: para cambiar la bolsa, Tesorería debe quitarlo del lote`)
      }
      if (ESTADOS_CAJA.includes(estado)) throw new ErrorGastos('Es de caja menor y ya se entregó el efectivo: la caja no se cambia')

      const [anterior, nueva] = await Promise.all([
        gasto.bolsaId ? Bolsas.findByPk(gasto.bolsaId, { transaction }) : Promise.resolve(null),
        Bolsas.findByPk(campos.bolsaId, { transaction })
      ])
      if (!nueva) throw new ErrorGastos('La bolsa no existe')
      const nota = `Cambio de bolsa de ${gasto.codigo}: ${anterior?.nombre ?? '(sin bolsa)'} → ${nueva.nombre}`
      cambios.unshift(`bolsa: ${anterior?.nombre ?? '(sin bolsa)'} → ${nueva.nombre}`)

      if (anterior) {
        const enAnterior = await MovimientosBolsa.findAll({
          where: { bolsaId: anterior.id, solicitudGastoId: gasto.id },
          attributes: ['valor'],
          transaction
        })
        const netoC = enAnterior.reduce((suma, m) => suma + aCentavos(m.valor), 0)

        // Reembolsable en una cuenta de cobro ya legalizada: lo legalizado volvió a la bolsa anterior
        const linea = await CuentasCobroGastos.findOne({
          where: { solicitudGastoId: gasto.id },
          include: [{ model: CuentasCobro, required: true, attributes: ['id', 'numeroCuentaCobro'], where: { fechaLegalizacion: { [Op.ne]: null } } }],
          transaction
        })
        const legalizadoC = linea ? aCentavos(linea.valorLegalizado) : 0

        const deLaAnterior: Movimiento[] = []
        const aLaNueva: Movimiento[] = []
        if (netoC !== 0) {
          deLaAnterior.push({ tipo: TIPOS_MOVIMIENTO_BOLSA.REVERSO, valor: -netoC / 100, solicitudGastoId: gasto.id, lotePagoId: gasto.lotePagoId ?? null, observacion: `${nota} (lo pagado pasa a la bolsa nueva)` })
          aLaNueva.push({ tipo: TIPOS_MOVIMIENTO_BOLSA.PAGO, valor: netoC / 100, solicitudGastoId: gasto.id, lotePagoId: gasto.lotePagoId ?? null, observacion: `${nota} (lo pagado viene de la bolsa anterior)` })
        }
        if (linea && legalizadoC !== 0) {
          const cuenta = `cuenta de cobro ${linea.cuentaCobro.numeroCuentaCobro}`
          deLaAnterior.push({ tipo: TIPOS_MOVIMIENTO_BOLSA.REVERSO, valor: -legalizadoC / 100, cuentaCobroId: linea.cuentaCobroId, observacion: `${nota} (lo legalizado en la ${cuenta} pasa a la bolsa nueva)` })
          aLaNueva.push({ tipo: TIPOS_MOVIMIENTO_BOLSA.LEGALIZACION, valor: legalizadoC / 100, cuentaCobroId: linea.cuentaCobroId, observacion: `${nota} (legalizado en la ${cuenta})` })
        }
        // Primero la nueva: si no le alcanza el saldo, no se toca nada
        if (aLaNueva.length) await registrarMovimientos(nueva.id, aLaNueva, usuarioId, transaction)
        if (deLaAnterior.length) await registrarMovimientos(anterior.id, deLaAnterior, usuarioId, transaction)
      }

      if (estado === ESTADOS_GASTO.CONTABILIZADO || gasto.documentoContable) {
        cambios.push(`ojo: el documento contable${gasto.documentoContable ? ` ${gasto.documentoContable}` : ''} quedó registrado con la bolsa anterior`)
      }
    }

    if (!cambios.length) throw new ErrorGastos('No hay cambios para guardar')

    await gasto.update({ ...campos, actualizadoPor: usuarioId }, { transaction })

    // Queda en el historial sin cambiar de estado
    await registrarTrazabilidad({
      solicitudGastoId: gasto.id,
      estadoAnteriorId: gasto.estadoId,
      estadoNuevoId: gasto.estadoId,
      usuarioId,
      observacion: `Edición del administrador: ${cambios.join('; ')}. Motivo: ${motivoLimpio}`
    }, transaction)

    return gasto
  })
