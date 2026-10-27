import { createHash } from 'crypto'
import { Op, type Transaction } from 'sequelize'
import { db } from '../../config/db'
import Bolsas from '../../models/gastos/bolsas'
import LotesPago from '../../models/gastos/lotesPago'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import DocumentosGasto from '../../models/gastos/documentosGasto'
import TiposDocumentoGasto from '../../models/gastos/tiposDocumentoGasto'
import { subirArchivo, eliminarArchivo } from '../azureFileStorage'
import { nombreSeguro } from '../../controllers/gastos/DocumentosGastoController'
import { registrarMovimientos, validarBolsaDelGasto, validarQueNoSeaDeCaja } from './bolsas'
import { cambiarEstadoGasto, codigoEstadoGasto, registrarTrazabilidad } from './estadosGasto'
import { ESTADOS_GASTO, ESTADOS_LOTE, TIPOS_DOCUMENTO, TIPOS_MOVIMIENTO_BOLSA } from './constantes'
import { ErrorGastos } from './errores'
import { formatoMoneda } from './formato'

// =====================================
// PAGO DE GASTOS EN TRES PASOS
//  1. Tesorería programa los gastos en un lote (PROGRAMADO). No toca la bolsa.
//  2. Dirección de Negocio aprueba (APROBADO_PAGO) o rechaza cada gasto; el rechazado vuelve a
//     SOLICITADO. Con todos aprobados el lote queda APROBADO.
//  3. Tesorería adjunta el soporte de pago de cada gasto (obligatorio; el del banco para el lote es
//     opcional) y confirma: se descuenta la bolsa y los gastos quedan PAGADO.
// Las compras de certificados (CTL, Cámara de Comercio y RUNT) no pasan por Dirección de Negocio:
// Tesorería - Certificados las paga directo (pagarDirecto).
// =====================================

export type DatosProgramacion = {
  bolsaId: number
  fechaPago: string            // fecha programada (YYYY-MM-DD)
  observacion?: string | null
  // Valor a pagar de cada gasto (en el frontend viene precargado con el valor solicitado)
  gastos: { id: number, valorProgramado: number }[]
}

export type DatosPagoDirecto = {
  bolsaId: number
  fechaPago: string
  observacion?: string | null
  gastos: { id: number, valorRealmentePagado: number }[]
  // Un mismo soporte cubre varios gastos (Tesorería lo confirmó en la ventana)
  soporteCompartido?: boolean
}

export type DatosConfirmacion = {
  fechaPago: string            // fecha real del pago
  observacion?: string | null
  // Un mismo soporte cubre varios gastos (Tesorería lo confirmó en la ventana)
  soporteCompartido?: boolean
}

const redondear = (valor: number) => Math.round(valor * 100) / 100
const aCentavos = (valor: number | string | null) => Math.round(Number(valor ?? 0) * 100)

// Lo que ya está programado o aprobado (sin pagar) desde una bolsa
const comprometidoEnBolsa = async (bolsaId: number, transaction: Transaction) => {
  const total = await LotesPago.sum('total', {
    where: { bolsaId, estado: [ESTADOS_LOTE.PROGRAMADO, ESTADOS_LOTE.APROBADO] },
    transaction
  })
  return aCentavos(total ?? 0)
}

// Bloquea el lote para que dos personas no lo cambien al mismo tiempo
const loteBloqueado = async (loteId: number, transaction: Transaction) => {
  const lote = await LotesPago.findByPk(loteId, { transaction, lock: transaction.LOCK.UPDATE })
  if (!lote) throw new ErrorGastos('El lote de pago no existe', 404)
  return lote
}

const gastosDelLote = (loteId: number, transaction: Transaction) =>
  SolicitudesGasto.findAll({ where: { lotePagoId: loteId }, transaction, lock: transaction.LOCK.UPDATE })

// Recalcula total y estado del lote según los gastos que le quedan
const actualizarLote = async (lote: LotesPago, usuarioId: number, transaction: Transaction) => {
  const gastos = await SolicitudesGasto.findAll({ where: { lotePagoId: lote.id }, transaction })
  const total = gastos.reduce((suma, g) => suma + aCentavos(g.valorProgramado), 0) / 100

  let estado: string = ESTADOS_LOTE.PROGRAMADO
  if (gastos.length === 0) estado = ESTADOS_LOTE.RECHAZADO
  else if (await todosEn(gastos, ESTADOS_GASTO.APROBADO_PAGO)) estado = ESTADOS_LOTE.APROBADO

  const recienAprobado = estado === ESTADOS_LOTE.APROBADO && lote.estado !== ESTADOS_LOTE.APROBADO
  await lote.update({
    total: String(total),
    estado,
    ...(recienAprobado ? { aprobadoPor: usuarioId, fechaAprobacion: new Date() } : {})
  }, { transaction })
  return lote
}

const todosEn = async (gastos: SolicitudesGasto[], estado: string) => {
  for (const gasto of gastos) {
    if (await codigoEstadoGasto(gasto.estadoId) !== estado) return false
  }
  return true
}

// ── 1. Programar ──────────────────────────

export const programarPago = (datos: DatosProgramacion, usuarioId: number) =>
  db.transaction(async transaction => {
    const ids = datos.gastos.map(g => g.id)
    if (new Set(ids).size !== ids.length) throw new ErrorGastos('Hay gastos repetidos en la programación')

    const bolsa = await Bolsas.findByPk(datos.bolsaId, { transaction, lock: transaction.LOCK.UPDATE })
    if (!bolsa?.activo) throw new ErrorGastos('La bolsa no existe o está inactiva')

    // Se bloquean los gastos para que nadie más los programe al mismo tiempo
    const gastos = await SolicitudesGasto.findAll({ where: { id: { [Op.in]: ids } }, transaction, lock: transaction.LOCK.UPDATE })
    if (gastos.length !== ids.length) throw new ErrorGastos('Uno o más gastos no existen')
    await validarQueNoSeaDeCaja(gastos, transaction)

    for (const gasto of gastos) {
      if (await codigoEstadoGasto(gasto.estadoId) !== ESTADOS_GASTO.SOLICITADO) {
        throw new ErrorGastos(`El gasto ${gasto.codigo} ya no está pendiente de pago`)
      }
      validarBolsaDelGasto(gasto, bolsa)
    }

    const porId = new Map(gastos.map(g => [g.id, g]))
    const programados = datos.gastos.map(g => ({ gasto: porId.get(g.id)!, valor: redondear(Number(g.valorProgramado)) }))
    const total = redondear(programados.reduce((suma, p) => suma + p.valor, 0))

    // La bolsa se descuenta al confirmar, pero no se programa más de lo que hay disponible
    // (las bolsas sin saldo pagan sin tener dinero)
    const disponible = aCentavos(bolsa.saldoActual) - await comprometidoEnBolsa(bolsa.id, transaction)
    if (!bolsa.sinSaldo && aCentavos(total) > disponible) {
      throw new ErrorGastos(
        `Saldo insuficiente en la bolsa ${bolsa.nombre}: disponible ${formatoMoneda(disponible / 100)} ` +
        `(saldo menos lo ya programado), requerido ${formatoMoneda(total)}`
      )
    }

    const lote = await LotesPago.create({
      bolsaId: bolsa.id,
      estado: ESTADOS_LOTE.PROGRAMADO,
      fechaPago: datos.fechaPago,
      total: String(total),
      creadoPor: usuarioId,
      observacion: datos.observacion || null
    }, { transaction })

    for (const { gasto, valor } of programados) {
      await cambiarEstadoGasto(gasto, ESTADOS_GASTO.PROGRAMADO, usuarioId, transaction, {
        observacion: `Programado para pago en el lote #${lote.id} (${bolsa.nombre}, ${formatoMoneda(valor)})`,
        cambios: { lotePagoId: lote.id, valorProgramado: String(valor) }
      })
    }

    return lote
  })

// ── 2. Aprobar / rechazar / quitar ────────

// Dirección de Negocio aprueba gastos programados del lote (todos si no se indican)
export const aprobarGastos = (loteId: number, gastoIds: number[] | null, usuarioId: number) =>
  db.transaction(async transaction => {
    const lote = await loteBloqueado(loteId, transaction)
    if (lote.estado !== ESTADOS_LOTE.PROGRAMADO) throw new ErrorGastos(`El lote #${lote.id} no está pendiente de aprobación`)

    const gastos = await gastosDelLote(lote.id, transaction)
    const pendientes: SolicitudesGasto[] = []
    for (const gasto of gastos) {
      if (await codigoEstadoGasto(gasto.estadoId) === ESTADOS_GASTO.PROGRAMADO) pendientes.push(gasto)
    }

    const aAprobar = gastoIds ? pendientes.filter(g => gastoIds.includes(g.id)) : pendientes
    if (gastoIds && aAprobar.length !== new Set(gastoIds).size) {
      throw new ErrorGastos('Uno o más gastos no están pendientes de aprobación en este lote')
    }
    if (!aAprobar.length) throw new ErrorGastos('No hay gastos pendientes de aprobación en este lote')

    for (const gasto of aAprobar) {
      await cambiarEstadoGasto(gasto, ESTADOS_GASTO.APROBADO_PAGO, usuarioId, transaction, {
        observacion: `Aprobado por Dirección de Negocio (lote #${lote.id})`
      })
    }

    return actualizarLote(lote, usuarioId, transaction)
  })

// Saca gastos del lote y los devuelve a SOLICITADO (Por pagar), con el motivo.
// La usan Dirección de Negocio (rechaza) y Tesorería (quita antes de confirmar).
export const sacarDelLote = (
  loteId: number,
  gastoIds: number[],
  motivo: string,
  usuarioId: number,
  quien: 'DIRECCION' | 'TESORERIA'
) =>
  db.transaction(async transaction => {
    const lote = await loteBloqueado(loteId, transaction)
    const permitidos: string[] = quien === 'DIRECCION'
      ? [ESTADOS_LOTE.PROGRAMADO]
      : [ESTADOS_LOTE.PROGRAMADO, ESTADOS_LOTE.APROBADO]
    if (!permitidos.includes(lote.estado)) throw new ErrorGastos(`El lote #${lote.id} ya no se puede modificar`)

    const gastos = (await gastosDelLote(lote.id, transaction)).filter(g => gastoIds.includes(g.id))
    if (gastos.length !== new Set(gastoIds).size) throw new ErrorGastos('Uno o más gastos no pertenecen a este lote')

    for (const gasto of gastos) {
      const estado = await codigoEstadoGasto(gasto.estadoId)
      // Dirección solo rechaza lo que aún no ha aprobado
      if (quien === 'DIRECCION' && estado !== ESTADOS_GASTO.PROGRAMADO) {
        throw new ErrorGastos(`El gasto ${gasto.codigo} ya fue aprobado`)
      }
      await cambiarEstadoGasto(gasto, ESTADOS_GASTO.SOLICITADO, usuarioId, transaction, {
        observacion: `${quien === 'DIRECCION' ? 'Rechazado por Dirección de Negocio' : 'Tesorería lo quitó del pago'} (lote #${lote.id}): ${motivo}`,
        cambios: { lotePagoId: null as unknown as number, valorProgramado: null }
      })
    }

    return actualizarLote(lote, usuarioId, transaction)
  })

// ── Soportes de pago ──────────────────────

// Archivos de la confirmación: `soporte_<gastoId>` es el soporte de ese gasto (obligatorio, uno
// distinto por gasto); `archivos` es el soporte del banco del lote (opcional)
export const separarSoportes = (archivos: Express.Multer.File[]) => {
  const porGasto = new Map<number, Express.Multer.File[]>()
  const delLote: Express.Multer.File[] = []
  for (const archivo of archivos) {
    const gastoId = Number(/^soporte_(\d+)$/.exec(archivo.fieldname)?.[1])
    if (gastoId) porGasto.set(gastoId, [...(porGasto.get(gastoId) ?? []), archivo])
    else delLote.push(archivo)
  }
  return { porGasto, delLote }
}

type ArchivoSubido = { rutaDirectorio: string, nombreArchivo: string }

const tipoSoportePago = async (transaction: Transaction) => {
  const tipo = await TiposDocumentoGasto.findOne({ where: { codigo: TIPOS_DOCUMENTO.SOPORTE_PAGO }, transaction })
  if (!tipo) throw new ErrorGastos('No existe el tipo de documento Soporte de pago', 500)
  return tipo
}

// Sube un archivo a Azure y lo registra como Soporte de pago del gasto o del lote.
// `subidos` lleva lo que ya está en Azure para borrarlo si la transacción falla
const guardarSoporte = async (
  archivo: Express.Multer.File,
  destino: { solicitudGastoId: number, carpeta: string } | { lotePagoId: number, carpeta: string },
  tipoDocumentoId: number,
  usuarioId: number,
  transaction: Transaction,
  subidos: ArchivoSubido[]
) => {
  const { carpeta, ...dueno } = destino
  const nombreArchivo = nombreSeguro(archivo.originalname)
  await subirArchivo(carpeta, nombreArchivo, archivo.buffer)
  subidos.push({ rutaDirectorio: carpeta, nombreArchivo })
  await DocumentosGasto.create({
    ...dueno,
    tipoDocumentoId,
    nombreOriginal: archivo.originalname,
    nombreArchivo,
    rutaDirectorio: carpeta,
    tipoArchivo: archivo.mimetype,
    tamano: archivo.size,
    subidoPor: usuarioId
  }, { transaction })
}

// Cada gasto pagado debe llevar su soporte de pago (decisión de Tesorería): se exige uno por gasto
// y que no sea el mismo archivo de otro gasto, salvo que Tesorería confirme que un solo pago del
// banco cubre esos gastos (`compartido`, 2026-10-27); entonces cada gasto guarda su copia. Queda en
// los documentos del gasto (así lo toma también el PDF de pago unificado de Legalización)
const adjuntarSoportesDeGastos = async (
  gastos: SolicitudesGasto[],
  porGasto: Map<number, Express.Multer.File[]>,
  usuarioId: number,
  transaction: Transaction,
  subidos: ArchivoSubido[],
  compartido = false
) => {
  const ids = new Set(gastos.map(g => g.id))
  for (const gastoId of porGasto.keys()) {
    if (!ids.has(gastoId)) throw new ErrorGastos('Hay un soporte de un gasto que no está en este pago')
  }

  const huellas = new Map<string, string>() // huella del archivo → gasto que lo usa
  for (const gasto of gastos) {
    const archivos = porGasto.get(gasto.id) ?? []
    if (!archivos.length) throw new ErrorGastos(`Adjunte el soporte de pago del gasto ${gasto.codigo}`)
    for (const archivo of archivos) {
      const huella = createHash('sha256').update(archivo.buffer).digest('hex')
      const otro = huellas.get(huella)
      if (otro && otro !== gasto.codigo && !compartido) {
        throw new ErrorGastos(`El soporte de ${gasto.codigo} es el mismo archivo de ${otro}: cada gasto lleva su propio soporte`)
      }
      huellas.set(huella, gasto.codigo)
    }
  }

  const tipo = await tipoSoportePago(transaction)
  for (const gasto of gastos) {
    for (const archivo of porGasto.get(gasto.id)!) {
      await guardarSoporte(archivo, { solicitudGastoId: gasto.id, carpeta: `gastos/${gasto.codigo}` }, tipo.id, usuarioId, transaction, subidos)
    }
  }
}

// Soporte del banco del lote (opcional, además del de cada gasto)
const adjuntarSoportesDelLote = async (loteId: number, archivos: Express.Multer.File[], usuarioId: number, transaction: Transaction, subidos: ArchivoSubido[]) => {
  if (!archivos.length) return
  const tipo = await tipoSoportePago(transaction)
  for (const archivo of archivos) {
    await guardarSoporte(archivo, { lotePagoId: loteId, carpeta: `gastos/lotes/lote-${loteId}` }, tipo.id, usuarioId, transaction, subidos)
  }
}

// Ejecuta el pago y, si falla, borra de Azure los soportes que alcanzó a subir (Azure no se revierte)
const conSoportes = async <T>(pago: (subidos: ArchivoSubido[]) => Promise<T>) => {
  const subidos: ArchivoSubido[] = []
  try {
    return await pago(subidos)
  } catch (error) {
    await Promise.allSettled(subidos.map(s => eliminarArchivo(s.rutaDirectorio, s.nombreArchivo)))
    throw error
  }
}

// ── Pago directo (compras de certificados) ──

// Paga en un solo paso: crea el lote ya PAGADO, descuenta la bolsa y los gastos quedan PAGADO,
// cada uno con su soporte de pago (obligatorio); el del banco para el lote es opcional.
// Quién puede usarlo (certificados y anticipos) lo valida el controlador.
export const pagarDirecto = (datos: DatosPagoDirecto, archivos: Express.Multer.File[], usuarioId: number) =>
  conSoportes(subidos => db.transaction(async transaction => {
    const ids = datos.gastos.map(g => g.id)
    if (new Set(ids).size !== ids.length) throw new ErrorGastos('Hay gastos repetidos en el pago')

    const bolsa = await Bolsas.findByPk(datos.bolsaId, { transaction })
    if (!bolsa?.activo) throw new ErrorGastos('La bolsa no existe o está inactiva')

    const gastos = await SolicitudesGasto.findAll({ where: { id: { [Op.in]: ids } }, transaction, lock: transaction.LOCK.UPDATE })
    if (gastos.length !== ids.length) throw new ErrorGastos('Uno o más gastos no existen')
    await validarQueNoSeaDeCaja(gastos, transaction)

    for (const gasto of gastos) {
      if (await codigoEstadoGasto(gasto.estadoId) !== ESTADOS_GASTO.SOLICITADO) {
        throw new ErrorGastos(`El gasto ${gasto.codigo} ya no está pendiente de pago`)
      }
      validarBolsaDelGasto(gasto, bolsa)
    }

    const porId = new Map(gastos.map(g => [g.id, g]))
    const pagos = datos.gastos.map(p => ({ gasto: porId.get(p.id)!, valor: redondear(Number(p.valorRealmentePagado)) }))
    const total = redondear(pagos.reduce((suma, p) => suma + p.valor, 0))

    const lote = await LotesPago.create({
      bolsaId: bolsa.id,
      estado: ESTADOS_LOTE.PAGADO,
      fechaPago: datos.fechaPago,
      total: String(total),
      creadoPor: usuarioId,
      confirmadoPor: usuarioId,
      fechaConfirmacion: new Date(),
      observacion: datos.observacion || null
    }, { transaction })

    // Descuenta la bolsa (valida saldo suficiente) con un movimiento por gasto
    await registrarMovimientos(
      bolsa.id,
      pagos.map(p => ({
        tipo: TIPOS_MOVIMIENTO_BOLSA.PAGO,
        valor: -p.valor,
        solicitudGastoId: p.gasto.id,
        lotePagoId: lote.id,
        observacion: `Pago ${p.gasto.codigo}`
      })),
      usuarioId,
      transaction
    )

    for (const { gasto, valor } of pagos) {
      const cambioBolsa = gasto.bolsaId && gasto.bolsaId !== bolsa.id
      await cambiarEstadoGasto(gasto, ESTADOS_GASTO.PAGADO, usuarioId, transaction, {
        observacion: `Pagado en el lote #${lote.id}${cambioBolsa ? ` (bolsa cambiada a ${bolsa.nombre})` : ''}`,
        cambios: {
          bolsaId: bolsa.id,
          lotePagoId: lote.id,
          fechaPago: datos.fechaPago,
          valorProgramado: String(valor),
          valorRealmentePagado: String(valor)
        }
      })
    }

    const { porGasto, delLote } = separarSoportes(archivos)
    await adjuntarSoportesDeGastos(gastos, porGasto, usuarioId, transaction, subidos, datos.soporteCompartido)
    await adjuntarSoportesDelLote(lote.id, delLote, usuarioId, transaction, subidos)

    return lote
  }))

// ── 3. Confirmar el pago ──────────────────

// Un solo lote (sin archivos): como ahora cada gasto debe llevar su soporte, responde cuál falta.
// La pantalla usa confirmarPagos
export const confirmarPago = async (loteId: number, datos: DatosConfirmacion, usuarioId: number) => {
  const { gastoIds } = await confirmarPagos([loteId], datos, [], usuarioId)
  return { lote: (await LotesPago.findByPk(loteId))!, gastoIds }
}

// Confirma uno o varios lotes aprobados a la vez (todos o ninguno). Cada gasto lleva su propio
// soporte de pago (`soporte_<gastoId>`, obligatorio); el soporte del banco (`archivos`) es
// opcional y se adjunta a cada lote.
export const confirmarPagos = (
  loteIds: number[],
  datos: DatosConfirmacion,
  archivos: Express.Multer.File[],
  usuarioId: number
) => {
  if (new Set(loteIds).size !== loteIds.length) throw new ErrorGastos('Hay lotes repetidos en la confirmación')
  const { porGasto, delLote } = separarSoportes(archivos)

  return conSoportes(subidos => db.transaction(async transaction => {
    // Primero los lotes (bloqueados): así no se sube nada si alguno no se puede confirmar
    for (const loteId of loteIds) verificarAprobado(await loteBloqueado(loteId, transaction))

    // Los soportes de todos los gastos de todos los lotes, juntos: así se detecta el mismo
    // archivo en gastos de lotes distintos
    const gastosDeLosLotes = await SolicitudesGasto.findAll({ where: { lotePagoId: loteIds }, order: [['id', 'ASC']], transaction })
    await adjuntarSoportesDeGastos(gastosDeLosLotes, porGasto, usuarioId, transaction, subidos, datos.soporteCompartido)

    const gastoIds: number[] = []
    for (const loteId of loteIds) {
      await adjuntarSoportesDelLote(loteId, delLote, usuarioId, transaction, subidos)
      const resultado = await confirmarPagoEn(transaction, loteId, datos, usuarioId)
      gastoIds.push(...resultado.gastoIds)
    }
    return { loteIds, gastoIds }
  }))
}

// Solo se confirma un lote que Dirección de Negocio aprobó completo
const verificarAprobado = (lote: LotesPago) => {
  if (lote.estado !== ESTADOS_LOTE.APROBADO) {
    throw new ErrorGastos(lote.estado === ESTADOS_LOTE.PROGRAMADO
      ? `El lote #${lote.id} aún tiene gastos pendientes de aprobación de Dirección de Negocio`
      : `El lote #${lote.id} no está aprobado para pago`)
  }
}

const confirmarPagoEn = async (transaction: Transaction, loteId: number, datos: DatosConfirmacion, usuarioId: number) => {
    const lote = await loteBloqueado(loteId, transaction)
    verificarAprobado(lote)

    const bolsa = await Bolsas.findByPk(lote.bolsaId, { transaction })
    if (!bolsa?.activo) throw new ErrorGastos('La bolsa del lote no existe o está inactiva')

    const gastos = await gastosDelLote(lote.id, transaction)
    if (!(await todosEn(gastos, ESTADOS_GASTO.APROBADO_PAGO))) {
      throw new ErrorGastos(`El lote #${lote.id} tiene gastos sin aprobar`)
    }

    // Descuenta la bolsa (valida saldo suficiente) con un movimiento por gasto
    await registrarMovimientos(
      bolsa.id,
      gastos.map(g => ({
        tipo: TIPOS_MOVIMIENTO_BOLSA.PAGO,
        valor: -Number(g.valorProgramado),
        solicitudGastoId: g.id,
        lotePagoId: lote.id,
        observacion: `Pago ${g.codigo}`
      })),
      usuarioId,
      transaction
    )

    for (const gasto of gastos) {
      const cambioBolsa = gasto.bolsaId && gasto.bolsaId !== bolsa.id
      await cambiarEstadoGasto(gasto, ESTADOS_GASTO.PAGADO, usuarioId, transaction, {
        observacion: `Pagado en el lote #${lote.id}${cambioBolsa ? ` (bolsa cambiada a ${bolsa.nombre})` : ''}`,
        cambios: {
          bolsaId: bolsa.id,
          fechaPago: datos.fechaPago,
          valorRealmentePagado: gasto.valorProgramado as string
        }
      })
    }

    await lote.update({
      estado: ESTADOS_LOTE.PAGADO,
      fechaPago: datos.fechaPago,
      confirmadoPor: usuarioId,
      fechaConfirmacion: new Date(),
      ...(datos.observacion ? { observacion: [lote.observacion, datos.observacion].filter(Boolean).join(' · ') } : {})
    }, { transaction })

    return { lote, gastoIds: gastos.map(g => g.id) }
}

// ── Corregir el valor de un gasto pagado ──

export type DatosCorreccionValor = {
  valorSolicitado: number
  valorPagado: number
  motivo: string
}

// Solo el Administrador de Gastos y solo con el gasto en PAGADO (decisión del usuario, 2026-10-27:
// Tesorería confirmó un pago con un cero de menos). Corrige el valor solicitado y el pagado, y la
// bolsa del pago se mueve por la diferencia con un AJUSTE (se pagó de más → vuelve dinero; de
// menos → se descuenta). El total del lote también se corrige.
export const corregirValorPagado = (gastoId: number, datos: DatosCorreccionValor, usuarioId: number) =>
  db.transaction(async transaction => {
    const gasto = await SolicitudesGasto.findByPk(gastoId, { transaction, lock: transaction.LOCK.UPDATE })
    if (!gasto) throw new ErrorGastos('El gasto no existe', 404)
    if (await codigoEstadoGasto(gasto.estadoId) !== ESTADOS_GASTO.PAGADO) {
      throw new ErrorGastos('Solo se puede corregir el valor de un gasto en estado Pagado')
    }

    const valorSolicitado = redondear(Number(datos.valorSolicitado))
    const valorPagado = redondear(Number(datos.valorPagado))
    if (!(valorSolicitado > 0) || !(valorPagado > 0)) throw new ErrorGastos('Los valores deben ser mayores a cero')

    const solicitadoAntes = aCentavos(gasto.valorSolicitadoPago)
    const pagadoAntes = aCentavos(gasto.valorRealmentePagado)
    const diferencia = aCentavos(valorPagado) - pagadoAntes
    if (aCentavos(valorSolicitado) === solicitadoAntes && diferencia === 0) {
      throw new ErrorGastos('Los valores son iguales a los actuales')
    }

    const cambios: string[] = []
    if (aCentavos(valorSolicitado) !== solicitadoAntes) {
      cambios.push(`valor solicitado ${formatoMoneda(solicitadoAntes / 100)} → ${formatoMoneda(valorSolicitado)}`)
    }
    if (diferencia !== 0) {
      cambios.push(`valor pagado ${formatoMoneda(pagadoAntes / 100)} → ${formatoMoneda(valorPagado)}`)
    }
    const detalle = `Valor corregido: ${cambios.join(', ')}. Motivo: ${datos.motivo.trim()}`

    if (diferencia !== 0) {
      // Valida saldo suficiente si se descuenta (salvo las bolsas sin saldo)
      await registrarMovimientos(gasto.bolsaId, [{
        tipo: TIPOS_MOVIMIENTO_BOLSA.AJUSTE,
        valor: -diferencia / 100,
        solicitudGastoId: gasto.id,
        lotePagoId: gasto.lotePagoId ?? null,
        observacion: `Corrección del pago ${gasto.codigo}: ${formatoMoneda(pagadoAntes / 100)} → ${formatoMoneda(valorPagado)}`
      }], usuarioId, transaction)

      if (gasto.lotePagoId) {
        const lote = await LotesPago.findByPk(gasto.lotePagoId, { transaction, lock: transaction.LOCK.UPDATE })
        if (lote) await lote.update({ total: String((aCentavos(lote.total) + diferencia) / 100) }, { transaction })
      }
    }

    await gasto.update({
      valorSolicitadoPago: String(valorSolicitado),
      valorProgramado: String(valorPagado),
      valorRealmentePagado: String(valorPagado),
      actualizadoPor: usuarioId
    }, { transaction })

    // Queda en el historial del gasto sin cambiar de estado
    await registrarTrazabilidad({
      solicitudGastoId: gasto.id,
      estadoAnteriorId: gasto.estadoId,
      estadoNuevoId: gasto.estadoId,
      usuarioId,
      observacion: detalle
    }, transaction)

    return gasto
  })
