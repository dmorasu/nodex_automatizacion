import { Op, QueryTypes, type Transaction } from 'sequelize'
import { db } from '../../config/db'
import Tramitador from '../../models/tramitador'
import Usuarios from '../../models/usuarios'
import CuentaCobros from '../../models/cuentaCobro'
import AccesoTramitador from '../../models/tramitadores/accesoTramitador'
import CuentaCobroTramitador, {
  ESTADOS_CUENTA_TRAMITADOR as ESTADOS,
  numeroCuentaTramitador,
  type DatosTramitadorCuenta,
  type EstadoCuentaTramitador
} from '../../models/cuentasCobroTramitador/cuentaCobroTramitador'
import LineaCuentaCobroTramitador, { TIPOS_LINEA_CUENTA as TIPOS, type TipoLineaCuenta } from '../../models/cuentasCobroTramitador/lineaCuentaCobroTramitador'
import HistorialCuentaCobroTramitador from '../../models/cuentasCobroTramitador/historialCuentaCobroTramitador'
import { ErrorGastos } from '../gastos/errores'
import { obtenerArchivo, subirArchivo } from '../azureFileStorage'
import Bolsas from '../../models/gastos/bolsas'
import { registrarMovimientos } from '../gastos/bolsas'
import { TIPOS_MOVIMIENTO_BOLSA } from '../gastos/constantes'
import { asegurarRetencion } from './retencion'

// =====================================
// CUENTAS DE COBRO DE LOS TRAMITADORES (2026-10-25)
// Los viernes el analista genera la precuenta de cada tramitador con sus trámites finalizados que
// no tienen cuenta de cobro; la revisa (valores, visitas fallidas, adicionales) y la envía a la app.
// El tramitador la aprueba con su firma o pide corrección. Torre de control da el visto bueno por
// semana (= radicación) y pasa a Tesorería, que la paga. Dinero en centavos.
// =====================================

// Solo entran los trámites finalizados desde esta fecha (decisión del usuario): los anteriores se
// cobraron por fuera de Nodex
export const FECHA_INICIO_CUENTAS = '2026-10-15'
const ESTADO_FINALIZADO = 6

const EDITABLES: EstadoCuentaTramitador[] = [ESTADOS.BORRADOR, ESTADOS.POR_CORREGIR]
// Lo que ve el tramitador en la app (el borrador todavía es del analista)
export const VISIBLES_TRAMITADOR: EstadoCuentaTramitador[] = [ESTADOS.CON_TRAMITADOR, ESTADOS.POR_CORREGIR, ESTADOS.APROBADA, ESTADOS.EN_TESORERIA, ESTADOS.PAGADA]

export const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
const fechaBogota = (fecha: Date) => fecha.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

// Viernes que cierra la semana (sábado a viernes) de una fecha YYYY-MM-DD
export const semanaDe = (fecha: string) => {
  const dia = new Date(`${fecha}T12:00:00Z`)
  dia.setUTCDate(dia.getUTCDate() + ((5 - dia.getUTCDay() + 7) % 7))
  return dia.toISOString().slice(0, 10)
}

export const pesos = (centavos: number | string) =>
  `$${Math.round(Number(centavos) / 100).toLocaleString('es-CO')}`

const aCentavos = (valor: unknown) => {
  const numero = Number(valor)
  if (!Number.isFinite(numero) || numero < 0) throw new ErrorGastos('El valor no es válido')
  return Math.round(numero * 100)
}

type Autor = { usuarioId?: number | null, tramitadorId?: number | null, nombre: string }

const registrar = (cuenta: CuentaCobroTramitador, autor: Autor, accion: string, detalle: string | null, transaction?: Transaction) =>
  HistorialCuentaCobroTramitador.create({
    cuentaId: cuenta.id,
    accion,
    estadoNuevo: cuenta.estado,
    detalle,
    usuarioId: autor.usuarioId ?? null,
    tramitadorId: autor.tramitadorId ?? null,
    nombre: autor.nombre
  }, { transaction })

export const autorUsuario = (usuario: { id: number, nombreUsuario: string }): Autor =>
  ({ usuarioId: usuario.id, nombre: usuario.nombreUsuario })

// Un solo proceso a la vez arma o cambia cuentas: así un trámite no entra en dos cuentas ni se
// repite un consecutivo
const bloquear = (transaction: Transaction) =>
  db.query(`SELECT pg_advisory_xact_lock(hashtext('tramitadores_cuentas_cobro'))`, { transaction })

const recalcularTotal = async (cuenta: CuentaCobroTramitador, transaction: Transaction) => {
  const total = await LineaCuentaCobroTramitador.sum('valor', { where: { cuentaId: cuenta.id }, transaction })
  await cuenta.update({ total: String(Math.round(Number(total) || 0)) }, { transaction })
}

// ── Datos del tramitador ──

export const datosDelTramitador = (t: Tramitador): DatosTramitadorCuenta => ({
  nombre: t.nombreTramitador.trim(),
  identificacion: t.identificacion,
  direccion: t.direccion?.trim() || null,
  ciudad: t.ciudad?.trim() || null,
  correo: t.correoTramitador?.trim() || null,
  telefono: t.numeroTramitador?.trim() || null,
  banco: t.banco?.trim() || null,
  tipoCuenta: t.tipoCuenta?.trim() || null,
  numeroCuenta: t.numeroCuenta?.trim() || null,
  declaracionArt383: t.declaracionArt383 !== false
})

// Lo que falta para poder enviar la cuenta (sale en el PDF)
export const datosFaltantes = (d: DatosTramitadorCuenta) => [
  !d.direccion && 'dirección',
  !d.ciudad && 'ciudad',
  !d.banco && 'banco',
  !d.numeroCuenta && 'número de cuenta'
].filter(Boolean) as string[]

// ── Trámites por cobrar ──

type TramitePorCobrar = {
  tramiteId: number
  tramitadorId: number
  operacionId: number | null
  centroCostos: string | null
  tipo: string | null
  fecha: string
  valor: string | null
}

const tramitesPorCobrar = (tramitadorIds: number[] | null, transaction?: Transaction) =>
  db.query<TramitePorCobrar>(`
    SELECT
      s.id AS "tramiteId", s."tramitadorId", s."operacionesId" AS "operacionId", o."centroDeCostos" AS "centroCostos",
      tr."nombreTramite" AS tipo,
      to_char((p."fechaFinalizacionServicio" AT TIME ZONE 'America/Bogota')::date, 'YYYY-MM-DD') AS fecha,
      p."valorTramite" AS valor
    FROM "SolicitudTramites" s
    JOIN "Programacion" p ON p."solicitudTramiteId" = s.id
    JOIN "Tramitador" t ON t.id = s."tramitadorId"
    LEFT JOIN "Operaciones" o ON o.id = s."operacionesId"
    LEFT JOIN "Tramites" tr ON tr.id = s."tramiteId"
    LEFT JOIN "CuentaCobros" cc ON cc."solicitudTramiteId" = s.id
    WHERE s."estadoActualTramite" = :finalizado
      AND NOT t."esMensajero"
      AND p."fechaFinalizacionServicio" IS NOT NULL
      AND (p."fechaFinalizacionServicio" AT TIME ZONE 'America/Bogota')::date >= CAST(:inicio AS DATE)
      AND NULLIF(TRIM(cc."numeroCuentaCobro"), '') IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM tramitadores_cuentas_cobro_lineas l
        JOIN tramitadores_cuentas_cobro c ON c.id = l.cuenta_id
        WHERE l.solicitud_tramite_id = s.id AND l.tipo = :tipoTramite AND c.estado <> :anulada
      )
      ${tramitadorIds ? 'AND s."tramitadorId" IN (:tramitadorIds)' : ''}
    ORDER BY fecha, s.id
  `, {
    type: QueryTypes.SELECT,
    transaction,
    replacements: { finalizado: ESTADO_FINALIZADO, inicio: FECHA_INICIO_CUENTAS, tipoTramite: TIPOS.TRAMITE, anulada: ESTADOS.ANULADA, tramitadorIds }
  })

// Pestaña "Por generar": por semana de finalizado (sábado a viernes), una fila por tramitador
export const porGenerar = async () => {
  const tramites = await tramitesPorCobrar(null)
  const ids = [...new Set(tramites.map(t => t.tramitadorId))]
  if (ids.length === 0) return []

  const [tramitadores, abiertas] = await Promise.all([
    Tramitador.findAll({ where: { id: ids } }),
    CuentaCobroTramitador.findAll({ where: { tramitadorId: ids, estado: EDITABLES }, attributes: ['id', 'tramitadorId', 'consecutivo', 'semana'] })
  ])

  const semanas = [...new Set(tramites.map(t => semanaDe(t.fecha)))].sort().reverse()
  return semanas.map(semana => {
    const deLaSemana = tramites.filter(t => semanaDe(t.fecha) === semana)
    const filas = tramitadores
      .filter(t => deLaSemana.some(x => x.tramitadorId === t.id))
      .map(t => {
        const suyos = deLaSemana.filter(x => x.tramitadorId === t.id)
        const abierta = abiertas.find(c => c.tramitadorId === t.id && c.semana === semana)
        return {
          tramitador: { id: t.id, nombre: t.nombreTramitador.trim(), identificacion: t.identificacion },
          cantidad: suyos.length,
          sinValor: suyos.filter(x => !Number(x.valor)).length,
          total: suyos.reduce((suma, x) => suma + Math.round(Number(x.valor ?? 0) * 100), 0),
          desde: suyos[0].fecha,
          hasta: suyos[suyos.length - 1].fecha,
          faltantes: datosFaltantes(datosDelTramitador(t)),
          // Si ya tiene un borrador de esa semana, los trámites se le agregan
          cuentaAbierta: abierta ? { id: abierta.id, numero: numeroCuentaTramitador(abierta.consecutivo) } : null
        }
      })
      .sort((a, b) => a.tramitador.nombre.localeCompare(b.tramitador.nombre, 'es'))
    return { semana, tramitadores: filas }
  })
}

// Botón "Generar precuenta": una cuenta por tramitador y semana, con los datos que tiene en
// Tramitadores (o se agregan a su borrador abierto de esa semana)
export const generarPrecuentas = async (pedidas: { tramitadorId: number, semana: string }[], usuario: { id: number, nombreUsuario: string }) => {
  const resultado: { tramitadorId: number, semana: string, cuentaId: number, numero: string, tramites: number, nueva: boolean }[] = []
  const unicas = [...new Map(pedidas.map(p => [`${p.tramitadorId}-${p.semana}`, p])).values()]

  for (const { tramitadorId, semana } of unicas) {
    await db.transaction(async transaction => {
      await bloquear(transaction)
      const tramites = (await tramitesPorCobrar([tramitadorId], transaction)).filter(t => semanaDe(t.fecha) === semana)
      if (tramites.length === 0) return

      let cuenta = await CuentaCobroTramitador.findOne({ where: { tramitadorId, semana, estado: EDITABLES }, order: [['id', 'ASC']], transaction })
      const nueva = !cuenta
      if (!cuenta) {
        const ultimo = await CuentaCobroTramitador.max<number, CuentaCobroTramitador>('consecutivo', { transaction })
        cuenta = await CuentaCobroTramitador.create({
          consecutivo: (Number(ultimo) || 0) + 1,
          tramitadorId,
          estado: ESTADOS.BORRADOR,
          semana,
          creadoPor: usuario.id
        }, { transaction })
      }

      await LineaCuentaCobroTramitador.bulkCreate(tramites.map(t => ({
        cuentaId: cuenta!.id,
        solicitudTramiteId: t.tramiteId,
        tipo: TIPOS.TRAMITE,
        concepto: (t.tipo?.trim() || 'Trámite').slice(0, 200),
        fecha: t.fecha,
        valor: String(Math.round(Number(t.valor ?? 0) * 100)),
        operacionId: t.operacionId,
        centroCostos: t.centroCostos?.trim() || null,
        creadaPorUsuario: usuario.id
      })), { transaction })
      await recalcularTotal(cuenta, transaction)

      const numeros = tramites.map(t => `#${t.tramiteId}`).join(', ')
      await registrar(cuenta, autorUsuario(usuario), nueva ? 'Precuenta generada' : 'Trámites agregados', `${tramites.length} trámite(s): ${numeros}`, transaction)
      resultado.push({ tramitadorId, semana, cuentaId: cuenta.id, numero: numeroCuentaTramitador(cuenta.consecutivo), tramites: tramites.length, nueva })
    })
  }
  return resultado
}

// ── Consulta ──

type FiltrosListado = { estados?: string[], tramitadorId?: number, q?: string, pagina?: number }

export const listarCuentas = async ({ estados, tramitadorId, q, pagina = 1 }: FiltrosListado) => {
  const where: any = {}
  if (estados?.length) where.estado = estados
  if (tramitadorId) where.tramitadorId = tramitadorId
  const texto = q?.trim()
  if (texto) {
    const numero = Number(texto.replace(/^cct-?/i, ''))
    where[Op.or] = [
      ...(Number.isInteger(numero) && numero > 0 ? [{ consecutivo: numero }] : []),
      { '$tramitador.nombreTramitador$': { [Op.iLike]: `%${texto}%` } },
      { '$tramitador.identificacion$': { [Op.iLike]: `%${texto}%` } }
    ]
  }
  const POR_PAGINA = 100
  const { rows, count } = await CuentaCobroTramitador.findAndCountAll({
    where,
    include: [{ model: Tramitador, attributes: ['id', 'nombreTramitador', 'identificacion'] }],
    order: [['semana', 'DESC'], ['consecutivo', 'DESC']],
    limit: POR_PAGINA,
    offset: (Math.max(1, pagina) - 1) * POR_PAGINA,
    distinct: true
  })
  const ids = rows.map(c => c.id)
  const cantidades = ids.length
    ? await db.query<{ cuentaId: number, cantidad: string }>(
      `SELECT cuenta_id AS "cuentaId", COUNT(*) AS cantidad FROM tramitadores_cuentas_cobro_lineas WHERE cuenta_id IN (:ids) AND tipo = :tipo GROUP BY cuenta_id`,
      { type: QueryTypes.SELECT, replacements: { ids, tipo: TIPOS.TRAMITE } })
    : []

  const conteos = await db.query<{ estado: string, cantidad: string }>(
    `SELECT estado, COUNT(*) AS cantidad FROM tramitadores_cuentas_cobro GROUP BY estado`, { type: QueryTypes.SELECT })

  return {
    cuentas: rows.map(c => ({
      id: c.id,
      numero: numeroCuentaTramitador(c.consecutivo),
      estado: c.estado,
      semana: c.semana,
      total: Number(c.total),
      tramites: Number(cantidades.find(x => x.cuentaId === c.id)?.cantidad ?? 0),
      tramitador: { id: c.tramitador.id, nombre: c.tramitador.nombreTramitador.trim(), identificacion: c.tramitador.identificacion },
      enviadaEn: c.enviadaEn,
      aprobadaEn: c.aprobadaEn,
      fechaRadicacion: c.fechaRadicacion,
      fechaPago: c.fechaPago,
      actualizadaEn: c.updatedAt
    })),
    total: count,
    porPagina: POR_PAGINA,
    conteos: Object.fromEntries(conteos.map(x => [x.estado, Number(x.cantidad)]))
  }
}

type FilaLinea = {
  id: number
  tramiteId: number
  tipo: TipoLineaCuenta
  concepto: string
  fecha: string
  valor: string
  centroCostos: string | null
  placa: string | null
  cliente: string | null
  creadaPorTramitador: number | null
  tieneSoporte: boolean
}

const lineasDe = (cuentaId: number) =>
  db.query<FilaLinea>(`
    SELECT l.id, l.solicitud_tramite_id AS "tramiteId", l.tipo, l.concepto, to_char(l.fecha, 'YYYY-MM-DD') AS fecha, l.valor,
      l.centro_costos AS "centroCostos", l.creada_por_tramitador AS "creadaPorTramitador", (l.soporte_nombre IS NOT NULL) AS "tieneSoporte",
      COALESCE(s.placa, s."matriculaInmobiliaria") AS placa, c."nombreCliente" AS cliente
    FROM tramitadores_cuentas_cobro_lineas l
    JOIN "SolicitudTramites" s ON s.id = l.solicitud_tramite_id
    LEFT JOIN "Clientes" c ON c.id = s."clienteId"
    WHERE l.cuenta_id = :cuentaId
    -- Dentro de cada trámite, en orden de fecha (la visita fallida suele ir antes del trámite)
    ORDER BY l.solicitud_tramite_id, l.fecha, CASE l.tipo WHEN 'TRAMITE' THEN 0 ELSE 1 END, l.id
  `, { type: QueryTypes.SELECT, replacements: { cuentaId } })

// Trámites con sus líneas, en el orden del anexo
export const agruparPorTramite = (lineas: FilaLinea[]) => {
  const grupos: { tramiteId: number, placa: string | null, cliente: string | null, lineas: (Omit<FilaLinea, 'valor'> & { valor: number })[], total: number }[] = []
  for (const l of lineas) {
    let grupo = grupos.find(g => g.tramiteId === l.tramiteId)
    if (!grupo) grupos.push(grupo = { tramiteId: l.tramiteId, placa: l.placa, cliente: l.cliente, lineas: [], total: 0 })
    grupo.lineas.push({ ...l, valor: Number(l.valor) })
    grupo.total += Number(l.valor)
  }
  return grupos
}

// Formato de distribución por centro de costos (porcentajes con dos decimales que suman 100)
export const distribucionDe = (lineas: { centroCostos: string | null, valor: string | number }[]) => {
  const porCentro = new Map<string, number>()
  for (const l of lineas) {
    const centro = l.centroCostos?.trim() || 'Sin centro de costos'
    porCentro.set(centro, (porCentro.get(centro) ?? 0) + Number(l.valor))
  }
  const total = [...porCentro.values()].reduce((a, b) => a + b, 0)
  const filas = [...porCentro.entries()]
    .map(([centroCostos, valor]) => ({ centroCostos, valor, porcentaje: total ? Math.round((valor / total) * 10000) / 100 : 0 }))
    .sort((a, b) => b.valor - a.valor)
  // El redondeo se ajusta en la fila mayor para que la suma dé 100
  if (filas.length && total) filas[0].porcentaje = Math.round((100 - filas.slice(1).reduce((a, f) => a + f.porcentaje, 0)) * 100) / 100
  return filas
}

const buscarCuenta = async (id: number, transaction?: Transaction) => {
  const cuenta = await CuentaCobroTramitador.findByPk(id, { include: [{ model: Tramitador }], transaction })
  if (!cuenta) throw new ErrorGastos('La cuenta de cobro no existe', 404)
  return cuenta
}

// Detalle completo (Torre de control y Tesorería). Mientras se puede editar, los datos del
// tramitador son los actuales; desde que se envía, los que se enviaron.
export const detalleCuenta = async (id: number) => {
  const cuenta = await buscarCuenta(id)
  const [lineas, historial, acceso] = await Promise.all([
    lineasDe(cuenta.id),
    HistorialCuentaCobroTramitador.findAll({ where: { cuentaId: cuenta.id }, order: [['createdAt', 'DESC'], ['id', 'DESC']] }),
    AccesoTramitador.findOne({ where: { tramitadorId: cuenta.tramitadorId }, attributes: ['id'] })
  ])
  const datos = EDITABLES.includes(cuenta.estado) || !cuenta.datosTramitador ? datosDelTramitador(cuenta.tramitador) : cuenta.datosTramitador
  const [usuarios, bolsa] = await Promise.all([
    Usuarios.findAll({
      where: { id: [cuenta.vistoBuenoPor, cuenta.pagadaPor].filter(Boolean) as number[] },
      attributes: ['id', 'nombreUsuario']
    }),
    cuenta.bolsaId ? Bolsas.findByPk(cuenta.bolsaId, { attributes: ['id', 'nombre'] }) : null
  ])
  const nombreUsuario = (id: number | null) => usuarios.find(u => u.id === id)?.nombreUsuario ?? null

  return {
    id: cuenta.id,
    numero: numeroCuentaTramitador(cuenta.consecutivo),
    estado: cuenta.estado,
    editable: EDITABLES.includes(cuenta.estado),
    semana: cuenta.semana,
    total: Number(cuenta.total),
    // Retención (fase 2): null hasta que llega a Tesorería
    retencion: cuenta.retencion === null ? null : Number(cuenta.retencion),
    neto: Number(cuenta.total) - Number(cuenta.retencion ?? 0),
    calculoRetencion: cuenta.calculoRetencion,
    retencionAjustada: cuenta.retencionAjustada,
    bolsa: bolsa ? { id: bolsa.id, nombre: bolsa.nombre } : null,
    tramitador: { id: cuenta.tramitadorId, ...datos, tieneAcceso: Boolean(acceso), tieneFirma: Boolean(cuenta.tramitador.firmaRuta) },
    faltantes: datosFaltantes(datos),
    tramites: agruparPorTramite(lineas),
    distribucion: distribucionDe(lineas),
    creadaEn: cuenta.createdAt,
    enviadaEn: cuenta.enviadaEn,
    aprobadaEn: cuenta.aprobadaEn,
    vistoBuenoEn: cuenta.vistoBuenoEn,
    vistoBuenoPor: nombreUsuario(cuenta.vistoBuenoPor),
    fechaRadicacion: cuenta.fechaRadicacion,
    fechaPago: cuenta.fechaPago,
    pagadaPor: nombreUsuario(cuenta.pagadaPor),
    observacionPago: cuenta.observacionPago,
    tieneSoportePago: Boolean(cuenta.soportePagoNombre),
    motivoAnulacion: cuenta.motivoAnulacion,
    historial: historial.map(h => ({ id: h.id, accion: h.accion, detalle: h.detalle, nombre: h.nombre, esTramitador: Boolean(h.tramitadorId), fecha: h.createdAt }))
  }
}

// ── Edición del analista (borrador o por corregir) ──

const cuentaEditable = async (id: number, transaction: Transaction) => {
  await bloquear(transaction)
  const cuenta = await buscarCuenta(id, transaction)
  if (!EDITABLES.includes(cuenta.estado)) throw new ErrorGastos('La cuenta ya no se puede modificar: está con el tramitador o ya se aprobó')
  return cuenta
}

const NOMBRE_TIPO: Record<TipoLineaCuenta, string> = { TRAMITE: 'Trámite', VISITA_FALLIDA: 'Visita fallida', ADICIONAL: 'Adicional' }

type DatosLinea = { valor?: unknown, concepto?: string, fecha?: string }

const validarFecha = (fecha: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(`${fecha}T00:00:00Z`))) throw new ErrorGastos('La fecha no es válida')
  if (fecha > hoyBogota()) throw new ErrorGastos('La fecha no puede ser futura')
  return fecha
}

const validarConcepto = (concepto: string) => {
  const texto = concepto.trim()
  if (!texto) throw new ErrorGastos('Indique el concepto')
  if (texto.length > 200) throw new ErrorGastos('El concepto puede tener máximo 200 caracteres')
  return texto
}

export const editarLinea = async (cuentaId: number, lineaId: number, datos: DatosLinea, autor: Autor) =>
  db.transaction(async transaction => {
    const cuenta = await cuentaEditable(cuentaId, transaction)
    const linea = await LineaCuentaCobroTramitador.findOne({ where: { id: lineaId, cuentaId }, transaction })
    if (!linea) throw new ErrorGastos('La línea no existe', 404)

    const cambios: string[] = []
    const valores: Partial<{ valor: string, concepto: string, fecha: string }> = {}
    if (datos.valor !== undefined) {
      const valor = String(aCentavos(datos.valor))
      if (valor !== String(linea.valor)) {
        cambios.push(`valor ${pesos(linea.valor)} → ${pesos(valor)}`)
        valores.valor = valor
      }
    }
    if (datos.concepto !== undefined) {
      const concepto = validarConcepto(datos.concepto)
      if (concepto !== linea.concepto) {
        cambios.push(`concepto "${linea.concepto}" → "${concepto}"`)
        valores.concepto = concepto
      }
    }
    if (datos.fecha !== undefined) {
      const fecha = validarFecha(datos.fecha)
      if (fecha !== linea.fecha) {
        cambios.push(`fecha ${linea.fecha} → ${fecha}`)
        valores.fecha = fecha
      }
    }
    if (cambios.length === 0) return
    await linea.update(valores, { transaction })
    await recalcularTotal(cuenta, transaction)
    await registrar(cuenta, autor, 'Línea modificada', `Trámite #${linea.solicitudTramiteId} · ${NOMBRE_TIPO[linea.tipo]}: ${cambios.join('; ')}`, transaction)
  })

// Visita fallida o adicional de un trámite que ya está en la cuenta
export const agregarLinea = async (cuentaId: number, datos: { solicitudTramiteId: number, tipo: string, concepto: string, fecha: string, valor: unknown }, autor: Autor) =>
  db.transaction(async transaction => {
    const cuenta = await cuentaEditable(cuentaId, transaction)
    if (datos.tipo !== TIPOS.VISITA_FALLIDA && datos.tipo !== TIPOS.ADICIONAL) throw new ErrorGastos('Tipo de línea no válido')
    const delTramite = await LineaCuentaCobroTramitador.findOne({
      where: { cuentaId, solicitudTramiteId: datos.solicitudTramiteId, tipo: TIPOS.TRAMITE }, transaction
    })
    if (!delTramite) throw new ErrorGastos(`El trámite #${datos.solicitudTramiteId} no está en esta cuenta`)
    const valor = aCentavos(datos.valor)
    if (valor <= 0) throw new ErrorGastos('Indique el valor')

    await LineaCuentaCobroTramitador.create({
      cuentaId,
      solicitudTramiteId: datos.solicitudTramiteId,
      tipo: datos.tipo,
      concepto: validarConcepto(datos.concepto),
      fecha: validarFecha(datos.fecha),
      valor: String(valor),
      operacionId: delTramite.operacionId,
      centroCostos: delTramite.centroCostos,
      creadaPorUsuario: autor.usuarioId ?? null,
      creadaPorTramitador: autor.tramitadorId ?? null
    }, { transaction })
    await recalcularTotal(cuenta, transaction)
    await registrar(cuenta, autor, 'Línea agregada', `Trámite #${datos.solicitudTramiteId} · ${NOMBRE_TIPO[datos.tipo]}: ${datos.concepto.trim()} ${pesos(valor)}`, transaction)
  })

// Quitar un trámite (con sus líneas: vuelve a "Por generar") o una visita fallida o adicional
export const quitarLinea = async (cuentaId: number, lineaId: number, autor: Autor) =>
  db.transaction(async transaction => {
    const cuenta = await cuentaEditable(cuentaId, transaction)
    const linea = await LineaCuentaCobroTramitador.findOne({ where: { id: lineaId, cuentaId }, transaction })
    if (!linea) throw new ErrorGastos('La línea no existe', 404)

    if (linea.tipo === TIPOS.TRAMITE) {
      await LineaCuentaCobroTramitador.destroy({ where: { cuentaId, solicitudTramiteId: linea.solicitudTramiteId }, transaction })
      await registrar(cuenta, autor, 'Trámite quitado', `Trámite #${linea.solicitudTramiteId} (vuelve a "Por generar")`, transaction)
    } else {
      await linea.destroy({ transaction })
      await registrar(cuenta, autor, 'Línea quitada', `Trámite #${linea.solicitudTramiteId} · ${NOMBRE_TIPO[linea.tipo]}: ${linea.concepto} ${pesos(linea.valor)}`, transaction)
    }
    await recalcularTotal(cuenta, transaction)
  })

// ── Recorrido ──

export const enviarAlTramitador = async (id: number, usuario: { id: number, nombreUsuario: string }) => {
  const cuenta = await db.transaction(async transaction => {
    const cuenta = await cuentaEditable(id, transaction)
    const lineas = await LineaCuentaCobroTramitador.findAll({ where: { cuentaId: id }, transaction })
    if (lineas.length === 0) throw new ErrorGastos('La cuenta no tiene trámites')
    const sinValor = lineas.filter(l => l.tipo === TIPOS.TRAMITE && !Number(l.valor)).map(l => `#${l.solicitudTramiteId}`)
    if (sinValor.length) throw new ErrorGastos(`Complete el valor de: ${sinValor.join(', ')}`)

    const datos = datosDelTramitador(cuenta.tramitador)
    const faltan = datosFaltantes(datos)
    if (faltan.length) throw new ErrorGastos(`Complete en Tramitadores los datos de ${datos.nombre}: ${faltan.join(', ')}`)
    const acceso = await AccesoTramitador.findOne({ where: { tramitadorId: cuenta.tramitadorId }, attributes: ['id'], transaction })
    if (!acceso) throw new ErrorGastos(`${datos.nombre} no tiene acceso a la app de tramitadores: créelo en Tramitadores para que pueda aprobar la cuenta`)

    await cuenta.update({ estado: ESTADOS.CON_TRAMITADOR, datosTramitador: datos, enviadaEn: new Date(), enviadaPor: usuario.id }, { transaction })
    await registrar(cuenta, autorUsuario(usuario), 'Enviada al tramitador', `Total ${pesos(cuenta.total)}`, transaction)
    return cuenta
  })
  return cuenta
}

// Torre de control la recupera para corregirla (antes del visto bueno)
export const retirarCuenta = async (id: number, motivo: string, usuario: { id: number, nombreUsuario: string }) =>
  db.transaction(async transaction => {
    await bloquear(transaction)
    const cuenta = await buscarCuenta(id, transaction)
    if (cuenta.estado !== ESTADOS.CON_TRAMITADOR && cuenta.estado !== ESTADOS.APROBADA) {
      throw new ErrorGastos('Solo se puede retirar una cuenta que está con el tramitador o aprobada por él')
    }
    await cuenta.update({ estado: ESTADOS.BORRADOR, aprobadaEn: null, firmaRuta: null, firmaNombre: null }, { transaction })
    await registrar(cuenta, autorUsuario(usuario), 'Retirada para corregir', motivo.trim() || null, transaction)
    return cuenta
  })

export const anularCuenta = async (id: number, motivo: string, usuario: { id: number, nombreUsuario: string }) =>
  db.transaction(async transaction => {
    await bloquear(transaction)
    const cuenta = await buscarCuenta(id, transaction)
    if (([ESTADOS.EN_TESORERIA, ESTADOS.PAGADA, ESTADOS.ANULADA] as string[]).includes(cuenta.estado)) {
      throw new ErrorGastos('La cuenta ya está en Tesorería, pagada o anulada')
    }
    if (!motivo.trim()) throw new ErrorGastos('Indique el motivo de la anulación')
    const estadoAnterior = cuenta.estado
    await cuenta.update({ estado: ESTADOS.ANULADA, motivoAnulacion: motivo.trim() }, { transaction })
    await registrar(cuenta, autorUsuario(usuario), 'Anulada', `${motivo.trim()} (sus trámites vuelven a "Por generar")`, transaction)
    return { cuenta, estadoAnterior }
  })

// Visto bueno de Torre de control (por semana): pasa a Tesorería y queda radicada. A cada trámite
// se le anota la cuenta de cobro (número, valor y fechas), así no vuelve a entrar en otra.
export const darVistoBueno = async (ids: number[], usuario: { id: number, nombreUsuario: string }) =>
  db.transaction(async transaction => {
    await bloquear(transaction)
    // En orden: si un tramitador tiene varias, cada retención ve lo retenido en las anteriores del mes
    const cuentas = await CuentaCobroTramitador.findAll({ where: { id: [...new Set(ids)] }, include: [{ model: Tramitador }], order: [['id', 'ASC']], transaction })
    if (cuentas.length === 0) throw new ErrorGastos('Elija las cuentas')
    const noAprobadas = cuentas.filter(c => c.estado !== ESTADOS.APROBADA)
    if (noAprobadas.length) {
      throw new ErrorGastos(`Solo las aprobadas por el tramitador reciben el visto bueno: ${noAprobadas.map(c => numeroCuentaTramitador(c.consecutivo)).join(', ')}`)
    }
    const hoy = hoyBogota()

    for (const cuenta of cuentas) {
      await cuenta.update({ estado: ESTADOS.EN_TESORERIA, vistoBuenoPor: usuario.id, vistoBuenoEn: new Date(), fechaRadicacion: hoy }, { transaction })
      await asegurarRetencion(cuenta, transaction)
      await registrar(cuenta, autorUsuario(usuario), 'Visto bueno: pasa a Tesorería', `Radicada el ${hoy} · retención ${pesos(cuenta.retencion ?? 0)}`, transaction)

      const numero = numeroCuentaTramitador(cuenta.consecutivo)
      const lineas = await LineaCuentaCobroTramitador.findAll({ where: { cuentaId: cuenta.id }, transaction })
      const porTramite = new Map<number, number>()
      for (const l of lineas) porTramite.set(l.solicitudTramiteId, (porTramite.get(l.solicitudTramiteId) ?? 0) + Number(l.valor))

      for (const [solicitudTramiteId, centavos] of porTramite) {
        const datos = {
          numeroCuentaCobro: numero,
          valorCuentaCobro: centavos / 100,
          fechaRadicacionCuentaCobro: hoy,
          fechaRecibidaCuentaCobroTramitador: cuenta.aprobadaEn ? fechaBogota(cuenta.aprobadaEn) : hoy
        }
        const existente = await CuentaCobros.findOne({ where: { solicitudTramiteId }, transaction })
        if (!existente) await CuentaCobros.create({ solicitudTramiteId, ...datos }, { transaction })
        else if (!existente.numeroCuentaCobro?.trim() || existente.numeroCuentaCobro === numero) await existente.update(datos, { transaction })
      }
    }
    return cuentas
  })

// Retención de una cuenta que ya está en Tesorería (la calcula si llegó antes de la fase 2)
export const prepararParaTesoreria = (id: number) =>
  db.transaction(async transaction => {
    await bloquear(transaction)
    const cuenta = await buscarCuenta(id, transaction)
    if (cuenta.estado === ESTADOS.EN_TESORERIA) await asegurarRetencion(cuenta, transaction)
  })

// Tesorería ajusta la retención que calculó Nodex (basta con el motivo, decisión del usuario)
export const ajustarRetencion = async (id: number, datos: { valor: unknown, motivo: string }, usuario: { id: number, nombreUsuario: string }) =>
  db.transaction(async transaction => {
    await bloquear(transaction)
    const cuenta = await asegurarRetencion(await buscarCuenta(id, transaction), transaction)
    if (cuenta.estado !== ESTADOS.EN_TESORERIA) throw new ErrorGastos('Solo se ajusta la retención de cuentas pendientes de pago en Tesorería')
    const valor = Math.round(aCentavos(datos.valor) / 100) * 100
    if (valor > Number(cuenta.total)) throw new ErrorGastos('La retención no puede ser mayor que el total de la cuenta')
    const motivo = datos.motivo?.trim()
    if (!motivo) throw new ErrorGastos('Indique el motivo del ajuste')
    const anterior = Number(cuenta.retencion ?? 0)
    if (valor === anterior) throw new ErrorGastos('La retención es igual a la actual')

    await cuenta.update({ retencion: String(valor), retencionAjustada: true }, { transaction })
    await registrar(cuenta, autorUsuario(usuario), 'Retención ajustada', `${pesos(anterior)} → ${pesos(valor)} · ${motivo}`, transaction)
    return cuenta
  })

// Tesorería marca la cuenta como pagada: el neto (total − retención) sale de la bolsa de no
// reembolsables que elija, en un solo movimiento ligado a la cuenta (fase 3, sin crear gastos)
export const marcarPagada = async (
  id: number,
  datos: { fechaPago: string, observacion?: string | null, bolsaId: unknown },
  soporte: Express.Multer.File | undefined,
  usuario: { id: number, nombreUsuario: string }
) => {
  const fechaPago = validarFecha(datos.fechaPago)
  let soporteDatos = {}
  if (soporte) {
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(soporte.mimetype)) throw new ErrorGastos('El soporte debe ser PDF, JPG o PNG')
    const ruta = `cuentas-cobro-tramitadores/${id}`
    const extension = soporte.mimetype === 'application/pdf' ? 'pdf' : soporte.mimetype === 'image/png' ? 'png' : 'jpg'
    const nombre = `soporte-pago-${Date.now()}.${extension}`
    await subirArchivo(ruta, nombre, soporte.buffer)
    soporteDatos = { soportePagoRuta: ruta, soportePagoNombre: nombre, soportePagoTipo: soporte.mimetype }
  }

  return db.transaction(async transaction => {
    await bloquear(transaction)
    const cuenta = await asegurarRetencion(await buscarCuenta(id, transaction), transaction)
    if (cuenta.estado !== ESTADOS.EN_TESORERIA) throw new ErrorGastos('Solo se pagan cuentas pendientes de pago en Tesorería')

    const bolsa = await Bolsas.findByPk(Number(datos.bolsaId), { transaction })
    if (!bolsa?.activo || !bolsa.sinSaldo) throw new ErrorGastos('Elija una bolsa de no reembolsables activa')
    const numero = numeroCuentaTramitador(cuenta.consecutivo)
    const neto = Number(cuenta.total) - Number(cuenta.retencion ?? 0)
    if (neto > 0) {
      await registrarMovimientos(bolsa.id, [{
        tipo: TIPOS_MOVIMIENTO_BOLSA.PAGO,
        valor: -neto / 100,
        observacion: `Cuenta de cobro ${numero} · ${cuenta.tramitador.nombreTramitador} (total ${pesos(cuenta.total)}, retención ${pesos(cuenta.retencion ?? 0)})`
      }], usuario.id, transaction)
    }

    await cuenta.update({
      estado: ESTADOS.PAGADA, fechaPago, pagadaPor: usuario.id, observacionPago: datos.observacion?.trim() || null, bolsaId: bolsa.id, ...soporteDatos
    }, { transaction })
    await registrar(cuenta, autorUsuario(usuario), 'Pagada', `Fecha de pago ${fechaPago} · neto ${pesos(neto)} de la bolsa ${bolsa.nombre}${datos.observacion?.trim() ? ` · ${datos.observacion.trim()}` : ''}`, transaction)

    const tramites = await LineaCuentaCobroTramitador.findAll({ where: { cuentaId: id, tipo: TIPOS.TRAMITE }, attributes: ['solicitudTramiteId'], transaction })
    for (const { solicitudTramiteId } of tramites) {
      const registro = await CuentaCobros.findOne({ where: { solicitudTramiteId, numeroCuentaCobro: numeroCuentaTramitador(cuenta.consecutivo) }, transaction })
      if (registro) await registro.update({ fechaPagoCuentaCobro: fechaPago }, { transaction })
    }
    return cuenta
  })
}

export const soportePago = async (id: number) => {
  const cuenta = await buscarCuenta(id)
  if (!cuenta.soportePagoRuta || !cuenta.soportePagoNombre) throw new ErrorGastos('La cuenta no tiene soporte de pago', 404)
  return { contenido: await obtenerArchivo(cuenta.soportePagoRuta, cuenta.soportePagoNombre), tipo: cuenta.soportePagoTipo ?? 'application/octet-stream', nombre: cuenta.soportePagoNombre }
}

// ── App del tramitador ──

const cuentaDelTramitador = async (tramitadorId: number, id: number, transaction?: Transaction) => {
  const cuenta = await buscarCuenta(id, transaction)
  if (cuenta.tramitadorId !== tramitadorId || !VISIBLES_TRAMITADOR.includes(cuenta.estado)) throw new ErrorGastos('La cuenta de cobro no existe', 404)
  return cuenta
}

export const cuentasDelTramitador = async (tramitadorId: number) => {
  const cuentas = await CuentaCobroTramitador.findAll({
    where: { tramitadorId, estado: VISIBLES_TRAMITADOR },
    order: [['consecutivo', 'DESC']],
    limit: 100
  })
  return cuentas.map(c => ({
    id: c.id,
    numero: numeroCuentaTramitador(c.consecutivo),
    estado: c.estado,
    total: Number(c.total),
    enviadaEn: c.enviadaEn,
    aprobadaEn: c.aprobadaEn,
    fechaPago: c.fechaPago
  }))
}

export const detalleParaTramitador = async (tramitadorId: number, id: number) => {
  const cuenta = await cuentaDelTramitador(tramitadorId, id)
  const lineas = await lineasDe(cuenta.id)
  return {
    id: cuenta.id,
    numero: numeroCuentaTramitador(cuenta.consecutivo),
    estado: cuenta.estado,
    total: Number(cuenta.total),
    enviadaEn: cuenta.enviadaEn,
    aprobadaEn: cuenta.aprobadaEn,
    fechaRadicacion: cuenta.fechaRadicacion,
    fechaPago: cuenta.fechaPago,
    tieneFirma: Boolean(cuenta.tramitador.firmaRuta),
    tramites: agruparPorTramite(lineas).map(g => ({
      tramiteId: g.tramiteId,
      placa: g.placa,
      total: g.total,
      lineas: g.lineas.map(l => ({ id: l.id, tipo: l.tipo, concepto: l.concepto, fecha: l.fecha, valor: l.valor }))
    }))
  }
}

// Aprobar = firmar: se guarda una copia de la firma actual con la cuenta (si después la cambia,
// el PDF de esta cuenta sigue con la firma con que la aprobó)
export const aprobarCuenta = async (tramitadorId: number, id: number) => {
  const cuenta = await cuentaDelTramitador(tramitadorId, id)
  if (cuenta.estado !== ESTADOS.CON_TRAMITADOR) throw new ErrorGastos('Esta cuenta ya no está pendiente de su aprobación')
  const tramitador = cuenta.tramitador
  if (!tramitador.firmaRuta || !tramitador.firmaNombre) throw new ErrorGastos('Primero registre su firma', 409)

  const firma = await obtenerArchivo(tramitador.firmaRuta, tramitador.firmaNombre)
  const ruta = `cuentas-cobro-tramitadores/${cuenta.id}`
  const nombre = `firma-${Date.now()}.png`
  await subirArchivo(ruta, nombre, firma)

  return db.transaction(async transaction => {
    await bloquear(transaction)
    await cuenta.reload({ transaction })
    if (cuenta.estado !== ESTADOS.CON_TRAMITADOR) throw new ErrorGastos('Esta cuenta ya no está pendiente de su aprobación')
    await cuenta.update({ estado: ESTADOS.APROBADA, aprobadaEn: new Date(), firmaRuta: ruta, firmaNombre: nombre }, { transaction })
    await registrar(cuenta, { tramitadorId, nombre: tramitador.nombreTramitador.trim() }, 'Aprobada por el tramitador', 'Firmada en la app', transaction)
    return cuenta
  })
}

export const pedirCorreccion = async (tramitadorId: number, id: number, comentario: string) =>
  db.transaction(async transaction => {
    await bloquear(transaction)
    const cuenta = await cuentaDelTramitador(tramitadorId, id, transaction)
    if (cuenta.estado !== ESTADOS.CON_TRAMITADOR) throw new ErrorGastos('Esta cuenta ya no está pendiente de su aprobación')
    const texto = comentario.trim()
    if (!texto) throw new ErrorGastos('Cuéntenos qué hay que corregir')
    await cuenta.update({ estado: ESTADOS.POR_CORREGIR }, { transaction })
    await registrar(cuenta, { tramitadorId, nombre: cuenta.tramitador.nombreTramitador.trim() }, 'Corrección pedida por el tramitador', texto, transaction)
    return cuenta
  })

// Adicional que agrega el tramitador (papelería, sobres…) con su soporte: la cuenta vuelve al
// analista para revisarlo y enviarla de nuevo
const TIPOS_SOPORTE = ['application/pdf', 'image/jpeg', 'image/png']

export const agregarAdicionalTramitador = async (
  tramitadorId: number,
  id: number,
  datos: { solicitudTramiteId: number, concepto: string, fecha: string, valor: unknown },
  soporte: Express.Multer.File | undefined
) => {
  if (!soporte) throw new ErrorGastos('Adjunte el soporte (foto o PDF)')
  if (!TIPOS_SOPORTE.includes(soporte.mimetype)) throw new ErrorGastos('El soporte debe ser PDF, JPG o PNG')
  const concepto = validarConcepto(datos.concepto)
  const fecha = validarFecha(datos.fecha)
  const valor = aCentavos(datos.valor)
  if (valor <= 0) throw new ErrorGastos('Indique el valor')

  const previa = await cuentaDelTramitador(tramitadorId, id)
  if (previa.estado !== ESTADOS.CON_TRAMITADOR) throw new ErrorGastos('Solo puede agregar adicionales a una cuenta por aprobar')
  const ruta = `cuentas-cobro-tramitadores/${id}`
  const extension = soporte.mimetype === 'application/pdf' ? 'pdf' : soporte.mimetype === 'image/png' ? 'png' : 'jpg'
  const nombre = `adicional-${Date.now()}.${extension}`
  await subirArchivo(ruta, nombre, soporte.buffer)

  return db.transaction(async transaction => {
    await bloquear(transaction)
    const cuenta = await cuentaDelTramitador(tramitadorId, id, transaction)
    if (cuenta.estado !== ESTADOS.CON_TRAMITADOR) throw new ErrorGastos('Solo puede agregar adicionales a una cuenta por aprobar')
    const delTramite = await LineaCuentaCobroTramitador.findOne({
      where: { cuentaId: id, solicitudTramiteId: datos.solicitudTramiteId, tipo: TIPOS.TRAMITE }, transaction
    })
    if (!delTramite) throw new ErrorGastos(`El trámite #${datos.solicitudTramiteId} no está en esta cuenta`)

    await LineaCuentaCobroTramitador.create({
      cuentaId: id,
      solicitudTramiteId: datos.solicitudTramiteId,
      tipo: TIPOS.ADICIONAL,
      concepto,
      fecha,
      valor: String(valor),
      operacionId: delTramite.operacionId,
      centroCostos: delTramite.centroCostos,
      creadaPorTramitador: tramitadorId,
      soporteRuta: ruta,
      soporteNombre: nombre,
      soporteTipo: soporte.mimetype
    }, { transaction })
    await cuenta.update({ estado: ESTADOS.POR_CORREGIR }, { transaction })
    await recalcularTotal(cuenta, transaction)
    const detalle = `Trámite #${datos.solicitudTramiteId}: ${concepto} ${pesos(valor)} (con soporte)`
    await registrar(cuenta, { tramitadorId, nombre: cuenta.tramitador.nombreTramitador.trim() }, 'Adicional agregado por el tramitador', detalle, transaction)
    return { cuenta, detalle }
  })
}

export const soporteLinea = async (cuentaId: number, lineaId: number) => {
  const linea = await LineaCuentaCobroTramitador.findOne({ where: { id: lineaId, cuentaId } })
  if (!linea?.soporteRuta || !linea.soporteNombre) throw new ErrorGastos('La línea no tiene soporte', 404)
  return { contenido: await obtenerArchivo(linea.soporteRuta, linea.soporteNombre), tipo: linea.soporteTipo ?? 'application/octet-stream', nombre: linea.soporteNombre }
}

// Firma dibujada en la pantalla del celular (PNG)
export const guardarFirma = async (tramitadorId: number, imagen: string) => {
  const base64 = imagen.replace(/^data:image\/png;base64,/, '')
  const contenido = Buffer.from(base64, 'base64')
  // Cabecera PNG; una firma pesa unos pocos KB
  if (contenido.length < 100 || contenido.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new ErrorGastos('La firma no es válida')
  if (contenido.length > 500 * 1024) throw new ErrorGastos('La firma es demasiado grande')

  const ruta = `tramitadores/${tramitadorId}/firma`
  const nombre = `firma-${Date.now()}.png`
  await subirArchivo(ruta, nombre, contenido)
  await Tramitador.update({ firmaRuta: ruta, firmaNombre: nombre }, { where: { id: tramitadorId } })
}

export const firmaDelTramitador = async (tramitadorId: number) => {
  const tramitador = await Tramitador.findByPk(tramitadorId, { attributes: ['id', 'firmaRuta', 'firmaNombre'] })
  if (!tramitador?.firmaRuta || !tramitador.firmaNombre) throw new ErrorGastos('No ha registrado su firma', 404)
  return obtenerArchivo(tramitador.firmaRuta, tramitador.firmaNombre)
}

export { buscarCuenta, lineasDe }
