import { Op, QueryTypes, type Transaction, type WhereOptions } from 'sequelize'
import { db } from '../../config/db'
import Bolsas from '../../models/gastos/bolsas'
import SolicitudesGasto from '../../models/gastos/solicitudesGasto'
import FormasPago from '../../models/gastos/formasPago'
import LegalizacionesCaja from '../../models/gastos/legalizacionesCaja'
import ReembolsosCaja from '../../models/gastos/reembolsosCaja'
import TrazabilidadReembolsosCaja from '../../models/gastos/trazabilidadReembolsosCaja'
import UsuariosCaja from '../../models/gastos/usuariosCaja'
import DocumentosGasto from '../../models/gastos/documentosGasto'
import TiposDocumentoGasto from '../../models/gastos/tiposDocumentoGasto'
import Usuarios from '../../models/usuarios'
import EstadosGasto from '../../models/gastos/estadosGasto'
import { subirArchivo, eliminarArchivo } from '../azureFileStorage'
import { nombreSeguro } from '../../controllers/gastos/DocumentosGastoController'
import { registrarMovimientos } from './bolsas'
import { cambiarEstadoGasto, codigoEstadoGasto } from './estadosGasto'
import {
  ESTADOS_GASTO, ESTADOS_REEMBOLSO_CAJA, FORMA_PAGO_CAJA_MENOR, TIPOS_BOLSA, TIPOS_DOCUMENTO, TIPOS_MOVIMIENTO_BOLSA,
  TOPE_ALERTA_CAJA
} from './constantes'
import { ErrorGastos } from './errores'
import { formatoMoneda } from './formato'

// =====================================
// CAJA MENOR (fondo fijo en efectivo por sede)
// 1. El usuario crea el gasto con forma de pago Caja menor y elige la caja (Bogotá, Medellín…).
// 2. Tesorería entrega el efectivo y lo marca pagado (PAGADO_CAJA): baja el saldo de la caja.
// 3. Tesorería legaliza el gasto con la factura y su soporte (PENDIENTE_REEMBOLSO). Si el soporte
//    es distinto a lo entregado, la diferencia entra o sale de la caja en ese momento.
// 4. Agrupa los pendientes en un reembolso (RCM-…, BORRADOR, gastos EN_REEMBOLSO), lo envía a
//    Dirección de Negocio (POR_APROBAR), que lo aprueba (APROBADO) o lo devuelve (BORRADOR).
// 5. Al recibir el dinero lo legaliza con fecha y soporte (LEGALIZADO): la caja se repone por el
//    total y los gastos quedan LEGALIZADO_CAJA.
// Cuadre: fondo = saldo + pagado sin legalizar + pendiente por reembolso + en reembolso.
// =====================================

const redondear = (valor: number) => Math.round(Number(valor) * 100) / 100
const aCentavos = (valor: number | string | null | undefined) => Math.round(Number(valor ?? 0) * 100)
const texto = (valor: unknown): string | null => String(valor ?? '').trim() || null

const generarCodigo = (id: number, fecha: Date) => `RCM-${fecha.getFullYear()}-${String(id).padStart(6, '0')}`

// ── Cajas ──────────────────────────────────

export const cajaBloqueada = async (bolsaId: number, transaction?: Transaction) => {
  const caja = await Bolsas.findByPk(bolsaId, { transaction, ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}) })
  if (!caja || caja.tipo !== TIPOS_BOLSA.CAJA_MENOR) throw new ErrorGastos('La caja menor no existe', 404)
  return caja
}

// Caja que maneja una auxiliar de caja menor. null si no tiene
export const cajaDelUsuario = async (usuarioId: number, transaction?: Transaction) => {
  const asignacion = await UsuariosCaja.findOne({ where: { usuarioId }, include: [{ model: Bolsas }], transaction })
  return asignacion?.bolsa ?? null
}

export type ResumenCaja = {
  id: number
  nombre: string
  activo: boolean
  fondo: number
  saldo: number
  topeAlerta: number
  bajoTope: boolean
  porPagar: { cantidad: number, valor: number }
  sinLegalizar: { cantidad: number, valor: number }
  pendienteReembolso: { cantidad: number, valor: number }
  enReembolso: { cantidad: number, valor: number }
  // fondo − (saldo + sin legalizar + pendiente + en reembolso): debe ser 0
  diferencia: number
}

// Saldo, lo comprometido y el cuadre de cada caja (todas o las indicadas)
export const resumenCajas = async (bolsaIds: number[] | null): Promise<ResumenCaja[]> => {
  const cajas = await Bolsas.findAll({
    where: { tipo: TIPOS_BOLSA.CAJA_MENOR, ...(bolsaIds ? { id: bolsaIds } : {}) },
    order: [['activo', 'DESC'], ['nombre', 'ASC']]
  })
  if (!cajas.length) return []

  // Por estado: lo entregado (pagado) o lo que dice el soporte (ya legalizado)
  const filas = await db.query<{ bolsa_id: number, codigo: string, cantidad: string, valor: string }>(`
    SELECT g.bolsa_id, e.codigo, COUNT(*) AS cantidad,
      SUM(CASE WHEN e.codigo IN ('PENDIENTE_REEMBOLSO', 'EN_REEMBOLSO') THEN l.valor_soporte
               WHEN e.codigo = 'SOLICITADO' THEN g.valor_solicitado_pago
               ELSE g.valor_realmente_pagado END) AS valor
    FROM gastos_solicitudes g
    JOIN gastos_estados_gasto e ON e.id = g.estado_id
    LEFT JOIN gastos_legalizaciones_caja l ON l.solicitud_gasto_id = g.id
    WHERE g.bolsa_id IN (:ids) AND e.codigo IN ('SOLICITADO', 'PAGADO_CAJA', 'PENDIENTE_REEMBOLSO', 'EN_REEMBOLSO')
    GROUP BY g.bolsa_id, e.codigo
  `, { type: QueryTypes.SELECT, replacements: { ids: cajas.map(c => c.id) } })

  return cajas.map(caja => {
    const de = (codigo: string) => {
      const fila = filas.find(f => f.bolsa_id === caja.id && f.codigo === codigo)
      return { cantidad: Number(fila?.cantidad ?? 0), valor: Number(fila?.valor ?? 0) }
    }
    const saldo = Number(caja.saldoActual)
    const fondo = Number(caja.fondoAsignado ?? 0)
    const topeAlerta = Number(caja.topeAlerta ?? TOPE_ALERTA_CAJA)
    const sinLegalizar = de(ESTADOS_GASTO.PAGADO_CAJA)
    const pendienteReembolso = de(ESTADOS_GASTO.PENDIENTE_REEMBOLSO)
    const enReembolso = de(ESTADOS_GASTO.EN_REEMBOLSO)
    return {
      id: caja.id,
      nombre: caja.nombre,
      activo: caja.activo,
      fondo,
      saldo,
      topeAlerta,
      bajoTope: saldo < topeAlerta,
      porPagar: de(ESTADOS_GASTO.SOLICITADO),
      sinLegalizar,
      pendienteReembolso,
      enReembolso,
      diferencia: (aCentavos(fondo) - aCentavos(saldo) - aCentavos(sinLegalizar.valor) - aCentavos(pendienteReembolso.valor) - aCentavos(enReembolso.valor)) / 100
    }
  })
}

// Crea la caja con su fondo inicial (entra como recarga)
export const crearCaja = (datos: { nombre: string, fondo: number, topeAlerta?: number | null }, usuarioId: number) =>
  db.transaction(async transaction => {
    const nombre = texto(datos.nombre)!
    if (await Bolsas.findOne({ where: { nombre }, transaction })) throw new ErrorGastos(`Ya existe una bolsa llamada ${nombre}`, 409)
    const fondo = redondear(datos.fondo)
    if (!(fondo > 0)) throw new ErrorGastos('El fondo de la caja debe ser mayor a cero')

    const caja = await Bolsas.create({
      nombre,
      tipo: TIPOS_BOLSA.CAJA_MENOR,
      fondoAsignado: String(fondo),
      topeAlerta: String(redondear(datos.topeAlerta ?? TOPE_ALERTA_CAJA))
    }, { transaction })
    await registrarMovimientos(caja.id, [{
      tipo: TIPOS_MOVIMIENTO_BOLSA.RECARGA, valor: fondo, observacion: 'Fondo inicial de la caja menor'
    }], usuarioId, transaction)
    return caja
  })

// Cambiar el fondo mueve el saldo por la diferencia (así el cuadre sigue en cero)
export const actualizarCaja = (id: number, datos: { nombre?: string, fondo?: number, topeAlerta?: number, activo?: boolean }, usuarioId: number) =>
  db.transaction(async transaction => {
    const caja = await cajaBloqueada(id, transaction)
    const nombre = texto(datos.nombre)
    if (nombre && await Bolsas.findOne({ where: { nombre, id: { [Op.ne]: caja.id } }, transaction })) {
      throw new ErrorGastos(`Ya existe una bolsa llamada ${nombre}`, 409)
    }

    if (datos.fondo !== undefined) {
      const fondo = redondear(datos.fondo)
      if (!(fondo > 0)) throw new ErrorGastos('El fondo de la caja debe ser mayor a cero')
      const diferencia = (aCentavos(fondo) - aCentavos(caja.fondoAsignado)) / 100
      if (diferencia !== 0) {
        await registrarMovimientos(caja.id, [{
          tipo: TIPOS_MOVIMIENTO_BOLSA.AJUSTE,
          valor: diferencia,
          observacion: `Cambio del fondo de ${formatoMoneda(caja.fondoAsignado)} a ${formatoMoneda(fondo)}`
        }], usuarioId, transaction)
        await caja.reload({ transaction })
      }
      await caja.update({ fondoAsignado: String(fondo) }, { transaction })
    }

    await caja.update({
      ...(nombre ? { nombre } : {}),
      ...(datos.topeAlerta !== undefined ? { topeAlerta: String(redondear(datos.topeAlerta)) } : {}),
      ...(datos.activo !== undefined ? { activo: datos.activo } : {})
    }, { transaction })
    return caja
  })

// Asigna (o quita, con bolsaId null) la caja que maneja una auxiliar
export const asignarCaja = async (usuarioId: number, bolsaId: number | null) => {
  if (!(await Usuarios.findByPk(usuarioId, { attributes: ['id'] }))) throw new ErrorGastos('El usuario no existe', 404)
  if (bolsaId === null) {
    await UsuariosCaja.destroy({ where: { usuarioId } })
    return
  }
  await cajaBloqueada(bolsaId)
  const actual = await UsuariosCaja.findOne({ where: { usuarioId } })
  if (actual) await actual.update({ bolsaId })
  else await UsuariosCaja.create({ usuarioId, bolsaId })
}

export const usuariosDeCajas = (bolsaIds: number[] | null) =>
  UsuariosCaja.findAll({
    where: bolsaIds ? { bolsaId: bolsaIds } : {},
    include: [{ model: Usuarios, attributes: ['id', 'nombreUsuario', 'correoUsuario'] }],
    order: [['bolsaId', 'ASC']]
  })

// ── Archivos ───────────────────────────────

// Sube los archivos a Azure y los registra (dentro de la transacción). `subidos` acumula lo que
// llegó a Azure para borrarlo si la transacción falla.
const guardarArchivos = async (
  archivos: Express.Multer.File[],
  rutaDirectorio: string,
  codigoTipo: string,
  vinculo: { solicitudGastoId?: number, reembolsoCajaId?: number },
  usuarioId: number,
  transaction: Transaction,
  subidos: { rutaDirectorio: string, nombreArchivo: string }[]
) => {
  const tipo = await TiposDocumentoGasto.findOne({ where: { codigo: codigoTipo }, transaction })
  if (!tipo) throw new ErrorGastos(`Falta el tipo de documento ${codigoTipo} en el catálogo`, 500)
  const registros = []
  for (const archivo of archivos) {
    const nombreArchivo = nombreSeguro(archivo.originalname)
    await subirArchivo(rutaDirectorio, nombreArchivo, archivo.buffer)
    subidos.push({ rutaDirectorio, nombreArchivo })
    registros.push({
      ...vinculo,
      tipoDocumentoId: tipo.id,
      nombreOriginal: archivo.originalname,
      nombreArchivo,
      rutaDirectorio,
      tipoArchivo: archivo.mimetype,
      tamano: archivo.size,
      subidoPor: usuarioId
    })
  }
  await DocumentosGasto.bulkCreate(registros, { transaction })
}

// Ejecuta la transacción y, si falla, borra de Azure lo que se alcanzó a subir
const conArchivos = async <T>(trabajo: (transaction: Transaction, subidos: { rutaDirectorio: string, nombreArchivo: string }[]) => Promise<T>) => {
  const subidos: { rutaDirectorio: string, nombreArchivo: string }[] = []
  try {
    return await db.transaction(transaction => trabajo(transaction, subidos))
  } catch (error) {
    await Promise.allSettled(subidos.map(a => eliminarArchivo(a.rutaDirectorio, a.nombreArchivo)))
    throw error
  }
}

// ── Gastos: pagar y legalizar ──────────────

const gastosBloqueados = async (ids: number[], transaction: Transaction) => {
  if (new Set(ids).size !== ids.length) throw new ErrorGastos('Hay gastos repetidos')
  const gastos = await SolicitudesGasto.findAll({ where: { id: { [Op.in]: ids } }, transaction, lock: transaction.LOCK.UPDATE, order: [['id', 'ASC']] })
  if (gastos.length !== ids.length) throw new ErrorGastos('Uno o más gastos no existen')
  return gastos
}

const exigirEstado = async (gasto: SolicitudesGasto, estado: string, mensaje: string) => {
  if (await codigoEstadoGasto(gasto.estadoId) !== estado) throw new ErrorGastos(`${gasto.codigo}: ${mensaje}`)
}

export type DatosPagoCaja = {
  bolsaId: number
  fechaPago: string
  observacion?: string | null
  // Efectivo entregado por gasto (precargado con el valor solicitado)
  gastos: { id: number, valorEntregado: number }[]
}

// Tesorería entrega el efectivo: baja el saldo de la caja (sin soporte: la plata se entrega en mano)
export const pagarConCaja = (datos: DatosPagoCaja, usuarioId: number) =>
  db.transaction(async transaction => {
    const caja = await cajaBloqueada(datos.bolsaId, transaction)
    if (!caja.activo) throw new ErrorGastos(`La caja ${caja.nombre} está inactiva`)
    const gastos = await gastosBloqueados(datos.gastos.map(g => g.id), transaction)
    const formaCaja = await FormasPago.findOne({ where: { codigo: FORMA_PAGO_CAJA_MENOR }, transaction })

    const pagos = []
    for (const gasto of gastos) {
      await exigirEstado(gasto, ESTADOS_GASTO.SOLICITADO, 'ya no está pendiente de pago')
      if (gasto.formaPagoId !== formaCaja?.id || gasto.bolsaId !== caja.id) {
        throw new ErrorGastos(`${gasto.codigo} no se paga con la caja ${caja.nombre}`)
      }
      const valor = redondear(datos.gastos.find(g => g.id === gasto.id)!.valorEntregado)
      if (!(valor > 0)) throw new ErrorGastos(`${gasto.codigo}: el valor entregado debe ser mayor a cero`)
      pagos.push({ gasto, valor })
    }

    await registrarMovimientos(caja.id, pagos.map(({ gasto, valor }) => ({
      tipo: TIPOS_MOVIMIENTO_BOLSA.PAGO,
      valor: -valor,
      solicitudGastoId: gasto.id,
      observacion: `Pago por caja menor ${gasto.codigo}`
    })), usuarioId, transaction)

    for (const { gasto, valor } of pagos) {
      await cambiarEstadoGasto(gasto, ESTADOS_GASTO.PAGADO_CAJA, usuarioId, transaction, {
        observacion: [`Efectivo entregado de ${caja.nombre}: ${formatoMoneda(valor)}`, texto(datos.observacion)].filter(Boolean).join(' · '),
        cambios: { fechaPago: datos.fechaPago, valorProgramado: String(valor), valorRealmentePagado: String(valor) }
      })
    }
    return { bolsaId: caja.id, ids: gastos.map(g => g.id) }
  })

export type DatosLegalizacionCaja = {
  numeroFactura: string
  fechaFactura: string
  beneficiario: string
  tipoIdentificacion: string
  identificacion: string
  placa?: string | null
  matriculaInmobiliaria?: string | null
  quienLegaliza: string
  valorSoporte: number
  observacion?: string | null
}

// Tesorería legaliza un gasto pagado por caja con la factura y su soporte (obligatorio)
export const legalizarGastoCaja = (gastoId: number, datos: DatosLegalizacionCaja, archivos: Express.Multer.File[], usuarioId: number) => {
  if (!archivos.length) throw new ErrorGastos('Adjunte el soporte del gasto')

  return conArchivos(async (transaction, subidos) => {
    const [gasto] = await gastosBloqueados([gastoId], transaction)
    await exigirEstado(gasto, ESTADOS_GASTO.PAGADO_CAJA, 'solo se legalizan gastos pagados por caja menor y aún sin legalizar')
    const caja = await cajaBloqueada(gasto.bolsaId, transaction)

    const valorSoporte = redondear(datos.valorSoporte)
    if (!(valorSoporte > 0)) throw new ErrorGastos('El valor del soporte debe ser mayor a cero')
    const diferencia = (aCentavos(valorSoporte) - aCentavos(gasto.valorRealmentePagado)) / 100

    // Sobrante: quien recibió el efectivo lo devuelve a la caja. Faltante: la caja paga la diferencia
    if (diferencia !== 0) {
      await registrarMovimientos(caja.id, [{
        tipo: diferencia < 0 ? TIPOS_MOVIMIENTO_BOLSA.REINTEGRO : TIPOS_MOVIMIENTO_BOLSA.PAGO,
        valor: -diferencia,
        solicitudGastoId: gasto.id,
        observacion: diferencia < 0
          ? `Sobrante devuelto a la caja al legalizar ${gasto.codigo}`
          : `Diferencia pagada por la caja al legalizar ${gasto.codigo}`
      }], usuarioId, transaction)
    }

    await LegalizacionesCaja.create({
      solicitudGastoId: gasto.id,
      bolsaId: caja.id,
      numeroFactura: texto(datos.numeroFactura)!.toUpperCase(),
      fechaFactura: datos.fechaFactura,
      beneficiario: texto(datos.beneficiario),
      tipoIdentificacion: datos.tipoIdentificacion,
      identificacion: texto(datos.identificacion),
      placa: texto(datos.placa)?.toUpperCase() ?? null,
      matriculaInmobiliaria: texto(datos.matriculaInmobiliaria),
      quienLegaliza: texto(datos.quienLegaliza),
      valorSoporte: String(valorSoporte),
      diferencia: String(diferencia),
      observacion: texto(datos.observacion),
      registradoPor: usuarioId
    }, { transaction })

    await guardarArchivos(archivos, `gastos/${gasto.codigo}`, TIPOS_DOCUMENTO.SOPORTE_CAJA_MENOR, { solicitudGastoId: gasto.id }, usuarioId, transaction, subidos)

    await cambiarEstadoGasto(gasto, ESTADOS_GASTO.PENDIENTE_REEMBOLSO, usuarioId, transaction, {
      observacion: [
        `Legalizado en caja menor: factura ${texto(datos.numeroFactura)!.toUpperCase()} por ${formatoMoneda(valorSoporte)} (trajo ${texto(datos.quienLegaliza)})`,
        diferencia !== 0 ? `diferencia con lo entregado: ${formatoMoneda(diferencia)}` : null
      ].filter(Boolean).join(' · ')
    })
    return { bolsaId: caja.id }
  })
}

// Deshace la legalización mientras no esté en un reembolso (devuelve la diferencia a como estaba).
// El soporte queda en los documentos del gasto.
export const deshacerLegalizacionCaja = (gastoId: number, usuarioId: number) =>
  db.transaction(async transaction => {
    const [gasto] = await gastosBloqueados([gastoId], transaction)
    await exigirEstado(gasto, ESTADOS_GASTO.PENDIENTE_REEMBOLSO, 'solo se deshace una legalización pendiente por reembolso')
    const legalizacion = await LegalizacionesCaja.findOne({ where: { solicitudGastoId: gasto.id }, transaction })
    if (!legalizacion) throw new ErrorGastos(`${gasto.codigo} no tiene legalización`)

    const diferencia = Number(legalizacion.diferencia)
    if (diferencia !== 0) {
      await registrarMovimientos(legalizacion.bolsaId, [{
        tipo: TIPOS_MOVIMIENTO_BOLSA.REVERSO,
        valor: diferencia,
        solicitudGastoId: gasto.id,
        observacion: `Se deshizo la legalización de ${gasto.codigo}`
      }], usuarioId, transaction)
    }
    await legalizacion.destroy({ transaction })
    await cambiarEstadoGasto(gasto, ESTADOS_GASTO.PAGADO_CAJA, usuarioId, transaction, { observacion: 'Se deshizo la legalización en caja menor' })
    return { bolsaId: legalizacion.bolsaId }
  })

// ── Reembolsos ─────────────────────────────

const registrarHistorial = (reembolsoCajaId: number, accion: string, detalle: string | null, usuarioId: number, transaction: Transaction) =>
  TrazabilidadReembolsosCaja.create({ reembolsoCajaId, accion, detalle, usuarioId }, { transaction })

// "GAS-2026-000012, GAS-2026-000015 ($ 230.000)"
const resumenGastos = async (gastos: SolicitudesGasto[], transaction: Transaction) => {
  const total = await LegalizacionesCaja.sum('valorSoporte', { where: { solicitudGastoId: gastos.map(g => g.id) }, transaction })
  return `${gastos.map(g => g.codigo).join(', ')} (${formatoMoneda(Number(total ?? 0))})`
}

const reembolsoBloqueado = async (id: number, transaction: Transaction) => {
  const reembolso = await ReembolsosCaja.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })
  if (!reembolso) throw new ErrorGastos('El reembolso no existe', 404)
  return reembolso
}

const exigirEstadoReembolso = (reembolso: ReembolsosCaja, estado: string, accion: string) => {
  if (reembolso.estado !== estado) throw new ErrorGastos(`El reembolso ${reembolso.codigo} no está ${estado.toLowerCase().replace('_', ' ')}: no se puede ${accion}`)
}

const recalcularTotal = async (reembolso: ReembolsosCaja, transaction: Transaction) => {
  const total = await LegalizacionesCaja.sum('valorSoporte', { where: { reembolsoCajaId: reembolso.id }, transaction })
  await reembolso.update({ total: String(redondear(Number(total ?? 0))) }, { transaction })
}

// Mete gastos pendientes de la misma caja al reembolso (EN_REEMBOLSO)
const agregarGastos = async (reembolso: ReembolsosCaja, gastoIds: number[], usuarioId: number, transaction: Transaction) => {
  const gastos = await gastosBloqueados(gastoIds, transaction)
  for (const gasto of gastos) {
    await exigirEstado(gasto, ESTADOS_GASTO.PENDIENTE_REEMBOLSO, 'no está pendiente por reembolso')
    if (gasto.bolsaId !== reembolso.bolsaId) throw new ErrorGastos(`${gasto.codigo} es de otra caja`)
    await LegalizacionesCaja.update({ reembolsoCajaId: reembolso.id }, { where: { solicitudGastoId: gasto.id }, transaction })
    await cambiarEstadoGasto(gasto, ESTADOS_GASTO.EN_REEMBOLSO, usuarioId, transaction, { observacion: `En el reembolso ${reembolso.codigo}` })
  }
  await recalcularTotal(reembolso, transaction)
  return gastos
}

// Devuelve gastos del reembolso a pendientes
const sacarGastos = async (reembolso: ReembolsosCaja, gastoIds: number[], usuarioId: number, observacion: string, transaction: Transaction) => {
  const gastos = await gastosBloqueados(gastoIds, transaction)
  for (const gasto of gastos) {
    const legalizacion = await LegalizacionesCaja.findOne({ where: { solicitudGastoId: gasto.id }, transaction })
    if (legalizacion?.reembolsoCajaId !== reembolso.id) throw new ErrorGastos(`${gasto.codigo} no está en el reembolso ${reembolso.codigo}`)
    await legalizacion.update({ reembolsoCajaId: null }, { transaction })
    await cambiarEstadoGasto(gasto, ESTADOS_GASTO.PENDIENTE_REEMBOLSO, usuarioId, transaction, { observacion })
  }
  // El resumen se arma antes de recalcular (después de sacarlos ya no suman)
  const detalle = gastos.length ? `${gastos.map(g => g.codigo).join(', ')}` : null
  await recalcularTotal(reembolso, transaction)
  return detalle
}

const gastosDelReembolso = async (reembolsoId: number, transaction: Transaction) =>
  (await LegalizacionesCaja.findAll({ where: { reembolsoCajaId: reembolsoId }, attributes: ['solicitudGastoId'], transaction })).map(l => l.solicitudGastoId)

export const crearReembolso = (datos: { bolsaId: number, gastoIds: number[], observacion?: string | null }, usuarioId: number) =>
  db.transaction(async transaction => {
    const caja = await cajaBloqueada(datos.bolsaId, transaction)
    if (!datos.gastoIds.length) throw new ErrorGastos('Seleccione los gastos del reembolso')
    const reembolso = await ReembolsosCaja.create({
      bolsaId: caja.id, estado: ESTADOS_REEMBOLSO_CAJA.BORRADOR, observacion: texto(datos.observacion), creadoPor: usuarioId
    }, { transaction })
    await reembolso.update({ codigo: generarCodigo(reembolso.id, reembolso.createdAt) }, { transaction })
    const gastos = await agregarGastos(reembolso, datos.gastoIds, usuarioId, transaction)
    await registrarHistorial(reembolso.id, 'CREADO', `Con ${gastos.length} gasto(s): ${await resumenGastos(gastos, transaction)}`, usuarioId, transaction)
    return reembolso
  })

export const agregarAlReembolso = (id: number, gastoIds: number[], usuarioId: number) =>
  db.transaction(async transaction => {
    const reembolso = await reembolsoBloqueado(id, transaction)
    exigirEstadoReembolso(reembolso, ESTADOS_REEMBOLSO_CAJA.BORRADOR, 'agregar gastos')
    const gastos = await agregarGastos(reembolso, gastoIds, usuarioId, transaction)
    await registrarHistorial(reembolso.id, 'AGREGADO', await resumenGastos(gastos, transaction), usuarioId, transaction)
    return reembolso
  })

export const quitarDelReembolso = (id: number, gastoIds: number[], usuarioId: number) =>
  db.transaction(async transaction => {
    const reembolso = await reembolsoBloqueado(id, transaction)
    exigirEstadoReembolso(reembolso, ESTADOS_REEMBOLSO_CAJA.BORRADOR, 'quitar gastos')
    const detalle = await sacarGastos(reembolso, gastoIds, usuarioId, `Se sacó del reembolso ${reembolso.codigo}`, transaction)
    await registrarHistorial(reembolso.id, 'QUITADO', detalle, usuarioId, transaction)
    return reembolso
  })

export const enviarReembolso = (id: number, usuarioId: number) =>
  db.transaction(async transaction => {
    const reembolso = await reembolsoBloqueado(id, transaction)
    exigirEstadoReembolso(reembolso, ESTADOS_REEMBOLSO_CAJA.BORRADOR, 'enviar a aprobación')
    if (!(await gastosDelReembolso(reembolso.id, transaction)).length) throw new ErrorGastos('El reembolso no tiene gastos')
    await reembolso.update({ estado: ESTADOS_REEMBOLSO_CAJA.POR_APROBAR, fechaEnvio: new Date() }, { transaction })
    await registrarHistorial(reembolso.id, 'ENVIADO', `Enviado a Dirección de Negocio por ${formatoMoneda(reembolso.total)}`, usuarioId, transaction)
    return reembolso
  })

// Dirección de Negocio
export const aprobarReembolso = (id: number, usuarioId: number) =>
  db.transaction(async transaction => {
    const reembolso = await reembolsoBloqueado(id, transaction)
    exigirEstadoReembolso(reembolso, ESTADOS_REEMBOLSO_CAJA.POR_APROBAR, 'aprobar')
    await reembolso.update({ estado: ESTADOS_REEMBOLSO_CAJA.APROBADO, aprobadoPor: usuarioId, fechaAprobacion: new Date(), motivoRechazo: null }, { transaction })
    await registrarHistorial(reembolso.id, 'APROBADO', `Aprobado por ${formatoMoneda(reembolso.total)}`, usuarioId, transaction)
    return reembolso
  })

// Vuelve a borrador con el motivo, para que Tesorería lo corrija y lo envíe de nuevo
export const rechazarReembolso = (id: number, motivo: string, usuarioId: number) =>
  db.transaction(async transaction => {
    const reembolso = await reembolsoBloqueado(id, transaction)
    exigirEstadoReembolso(reembolso, ESTADOS_REEMBOLSO_CAJA.POR_APROBAR, 'rechazar')
    await reembolso.update({ estado: ESTADOS_REEMBOLSO_CAJA.BORRADOR, motivoRechazo: motivo.trim() }, { transaction })
    await registrarHistorial(reembolso.id, 'DEVUELTO', motivo.trim(), usuarioId, transaction)
    return reembolso
  })

// Llegó el dinero: la caja se repone por el total y los gastos quedan legalizados
export const legalizarReembolso = (id: number, datos: { fechaLegalizacion: string, observacion?: string | null }, archivos: Express.Multer.File[], usuarioId: number) => {
  if (!archivos.length) throw new ErrorGastos('Adjunte el soporte del reembolso')

  return conArchivos(async (transaction, subidos) => {
    const reembolso = await reembolsoBloqueado(id, transaction)
    exigirEstadoReembolso(reembolso, ESTADOS_REEMBOLSO_CAJA.APROBADO, 'legalizar (debe estar aprobado por Dirección de Negocio)')
    const ids = await gastosDelReembolso(reembolso.id, transaction)

    await registrarMovimientos(reembolso.bolsaId, [{
      tipo: TIPOS_MOVIMIENTO_BOLSA.REEMBOLSO_CAJA,
      valor: Number(reembolso.total),
      observacion: `Reembolso ${reembolso.codigo} legalizado`
    }], usuarioId, transaction)

    for (const gasto of await gastosBloqueados(ids, transaction)) {
      await cambiarEstadoGasto(gasto, ESTADOS_GASTO.LEGALIZADO_CAJA, usuarioId, transaction, { observacion: `Reembolso ${reembolso.codigo} legalizado` })
    }

    await guardarArchivos(archivos, `gastos/reembolsos-caja/${reembolso.codigo}`, TIPOS_DOCUMENTO.SOPORTE_REEMBOLSO_CAJA, { reembolsoCajaId: reembolso.id }, usuarioId, transaction, subidos)
    await reembolso.update({
      estado: ESTADOS_REEMBOLSO_CAJA.LEGALIZADO,
      legalizadoPor: usuarioId,
      fechaLegalizacion: datos.fechaLegalizacion,
      observacion: [reembolso.observacion, texto(datos.observacion)].filter(Boolean).join(' · ') || null
    }, { transaction })
    await registrarHistorial(
      reembolso.id, 'LEGALIZADO',
      [`Dinero recibido el ${datos.fechaLegalizacion}: la caja se repuso por ${formatoMoneda(reembolso.total)}`, texto(datos.observacion)].filter(Boolean).join(' · '),
      usuarioId, transaction
    )
    return reembolso
  })
}

// Solo un borrador: sus gastos vuelven a pendientes por reembolso
export const anularReembolso = (id: number, usuarioId: number) =>
  db.transaction(async transaction => {
    const reembolso = await reembolsoBloqueado(id, transaction)
    exigirEstadoReembolso(reembolso, ESTADOS_REEMBOLSO_CAJA.BORRADOR, 'anular')
    const detalle = await sacarGastos(reembolso, await gastosDelReembolso(reembolso.id, transaction), usuarioId, `Se anuló el reembolso ${reembolso.codigo}`, transaction)
    await reembolso.update({ estado: ESTADOS_REEMBOLSO_CAJA.ANULADO }, { transaction })
    await registrarHistorial(reembolso.id, 'ANULADO', detalle ? `Volvieron a pendientes: ${detalle}` : null, usuarioId, transaction)
    return reembolso
  })

// ── Alerta de saldo ────────────────────────

// Después de cada movimiento: si el disponible baja del tope se avisa una vez a Tesorería;
// cuando se repone por encima, la alerta se rearma. Nunca lanza.
export const revisarTopeCaja = async (bolsaId: number, avisar: (caja: Bolsas) => Promise<void>) => {
  try {
    const caja = await Bolsas.findByPk(bolsaId)
    if (!caja || caja.tipo !== TIPOS_BOLSA.CAJA_MENOR) return
    const bajo = Number(caja.saldoActual) < Number(caja.topeAlerta ?? TOPE_ALERTA_CAJA)
    if (bajo && !caja.alertaTopeEnviada) {
      await caja.update({ alertaTopeEnviada: true })
      await avisar(caja)
    } else if (!bajo && caja.alertaTopeEnviada) {
      await caja.update({ alertaTopeEnviada: false })
    }
  } catch (error) {
    console.error(`⚠️ No se pudo revisar el tope de la caja ${bolsaId}:`, error)
  }
}

// ── Historial de la caja ───────────────────

// Estados por los que pasa un gasto ya pagado por caja (lo que se consulta en el historial)
export const ESTADOS_HISTORIAL_CAJA: string[] = [
  ESTADOS_GASTO.PAGADO_CAJA, ESTADOS_GASTO.PENDIENTE_REEMBOLSO, ESTADOS_GASTO.EN_REEMBOLSO, ESTADOS_GASTO.LEGALIZADO_CAJA
]

export type FiltrosHistorialCaja = {
  estado?: string | null
  desde?: string | null       // fecha de entrega del efectivo (YYYY-MM-DD)
  hasta?: string | null
  quienLegaliza?: string | null
  busqueda?: string | null
}

// Todos los gastos pagados por la caja con su legalización y su reembolso, filtrados, con los
// totales de lo filtrado. La caja menor mueve pocos gastos: se consulta todo y se pagina en memoria.
export const historialCaja = async (bolsaId: number, filtros: FiltrosHistorialCaja) => {
  const estados = await EstadosGasto.findAll({ where: { codigo: ESTADOS_HISTORIAL_CAJA }, attributes: ['id', 'codigo'] })
  const estadoIds = estados.filter(e => !filtros.estado || e.codigo === filtros.estado).map(e => e.id)

  const condiciones: WhereOptions[] = [{ bolsaId }, { estadoId: estadoIds }]
  if (filtros.desde) condiciones.push({ fechaPago: { [Op.gte]: filtros.desde } })
  if (filtros.hasta) condiciones.push({ fechaPago: { [Op.lte]: filtros.hasta } })
  const quien = texto(filtros.quienLegaliza)
  if (quien) condiciones.push({ '$legalizacionCaja.quien_legaliza$': { [Op.iLike]: `%${quien}%` } })
  const busqueda = texto(filtros.busqueda)
  if (busqueda) {
    const patron = { [Op.iLike]: `%${busqueda}%` }
    condiciones.push({
      [Op.or]: [
        { codigo: patron }, { conceptoPago: patron }, { placa: patron }, { matriculaInmobiliaria: patron },
        { '$legalizacionCaja.numero_factura$': patron }, { '$legalizacionCaja.beneficiario$': patron },
        { '$legalizacionCaja.identificacion$': patron }, { '$legalizacionCaja.reembolso.codigo$': patron }
      ]
    })
  }

  const gastos = await SolicitudesGasto.findAll({
    where: { [Op.and]: condiciones },
    attributes: ['id', 'codigo', 'conceptoPago', 'placa', 'matriculaInmobiliaria', 'valorSolicitadoPago', 'valorRealmentePagado', 'fechaPago', 'createdAt'],
    include: [
      { model: EstadosGasto, attributes: ['codigo', 'nombre'] },
      { model: Usuarios, as: 'creador', attributes: ['id', 'nombreUsuario'] },
      {
        model: LegalizacionesCaja,
        required: false,
        include: [
          { model: ReembolsosCaja, attributes: ['id', 'codigo', 'estado', 'fechaLegalizacion'] },
          { model: Usuarios, as: 'registrador', attributes: ['id', 'nombreUsuario'] }
        ]
      }
    ],
    order: [['fechaPago', 'DESC'], ['id', 'DESC']],
    limit: 5000
  })

  const suma = (valores: (string | null | undefined)[]) => valores.reduce((t, v) => t + aCentavos(v), 0) / 100
  const legalizados = gastos.filter(g => g.legalizacionCaja)
  return {
    totales: {
      cantidad: gastos.length,
      entregado: suma(gastos.map(g => g.valorRealmentePagado)),
      soporte: suma(legalizados.map(g => g.legalizacionCaja.valorSoporte)),
      sinLegalizar: gastos.length - legalizados.length
    },
    gastos
  }
}
