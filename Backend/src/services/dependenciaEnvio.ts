import { QueryTypes, type Model, type Transaction } from 'sequelize'
import { db } from '../config/db'
import SolicitudTramites from '../models/solicitudTramites'
import Programacion from '../models/programacion'
import EstadosTramites from '../models/estadosTramites'
import SolicitudesGasto from '../models/gastos/solicitudesGasto'
import HistorialTramite, { type CambioCampo } from '../models/historialTramite'
import { ErrorGastos } from './gastos/errores'
import { separarPlacas } from './placasTramite'
import { contextoActual, type ContextoPeticion } from '../utils/contextoPeticion'

// =====================================
// TRÁMITES QUE DEPENDEN DE UN ENVÍO DE DOCUMENTOS (pedido de Torre de control, 2026-11-04)
// Al crear o editar el trámite se marca "¿Depende de envío de documentos?" y se relaciona un envío
// (otro trámite de tipo "Envío de documentación" o "Envío de tarjeta") de la misma placa o matrícula.
// Mientras el envío no esté Finalizado y los gastos del trámite no estén pagados:
//   · no se le puede poner la fecha de diligencia (venga de donde venga: guardia en Programacion);
//   · los indicadores del tablero no le cuentan tiempo.
// Decisiones del usuario: el pago son los gastos del propio trámite (todos los no anulados pagados);
// asignar tramitador sí se permite; el envío se puede relacionar después, al editar.
// Desde el 2026-11-10 (caso del #6284, decisión del usuario): si el trámite no tiene gastos, o todos
// están anulados, basta con que el envío esté Finalizado. Antes se exigía al menos un gasto y los
// trámites que no llevan pago (ej. Entrega Documentos) no se liberaban nunca.
// Cuando se cumplen las dos condiciones queda la fecha en `condicionesEnvioCumplidasEn` y el trámite
// queda liberado: un gasto nuevo después no lo vuelve a bloquear. Cambiar el envío o la marca lo
// vuelve a revisar desde cero.
// Cada movimiento del envío y de los gastos queda en el historial del trámite.
// =====================================

// Mismo criterio del tablero (tableroTramites.ts): por el nombre del tipo de trámite
export const TIPOS_ENVIO = '^env[ií]o de (documentaci[oó]n|tarjeta)'
const FINALIZADO = 'Finalizado'
const DESISTIDO = 'Desistido'
// Estados de gasto que todavía no tienen el pago hecho (los anulados no cuentan)
const GASTO_SIN_PAGAR = ['SOLICITADO', 'PROGRAMADO', 'APROBADO_PAGO']

const clave = (valor: unknown) => String(valor ?? '').trim().toUpperCase() || null

const textoFecha = (fecha: string | null) => {
  if (!fecha) return null
  const [anio, mes, dia] = fecha.slice(0, 10).split('-')
  return `${dia}/${mes}/${anio}`
}

// ── Envíos que se pueden relacionar ──

export type EnvioRelacionable = {
  id: number
  tipo: string
  estado: string
  finalizado: boolean
  finalizadoEl: string | null // YYYY-MM-DD (Bogotá)
  creadoEl: string
  cliente: string | null
}

// Envíos de la misma placa o matrícula (sin desistidos), los más recientes primero
export const enviosRelacionables = async (
  { placa, matricula, excluirId }: { placa?: unknown, matricula?: unknown, excluirId?: number | null },
  transaction?: Transaction | null
): Promise<EnvioRelacionable[]> => {
  // Con varias placas, sirve el envío que tenga cualquiera de ellas (tabla de placas, con índice)
  const placas = separarPlacas(placa)
  const p = placas.length ? placas : null
  const m = clave(matricula)
  if (!p && !m) return []
  return db.query<EnvioRelacionable>(`
    SELECT s.id, tr."nombreTramite" AS tipo, COALESCE(e."nombreEstado", 'Sin Iniciar') AS estado,
      COALESCE(e."nombreEstado" = :finalizado, false) AS finalizado,
      CASE WHEN e."nombreEstado" = :finalizado
        THEN to_char(COALESCE(p."fechaFinalizacionServicio", u.fecha) AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') END AS "finalizadoEl",
      to_char(s."createdAt" AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS "creadoEl",
      c."nombreCliente" AS cliente
    FROM "SolicitudTramites" s
    JOIN "Tramites" tr ON tr.id = s."tramiteId" AND tr."nombreTramite" ~* :tiposEnvio
    LEFT JOIN "Estados" e ON e.id = s."estadoActualTramite"
    LEFT JOIN "Programacion" p ON p."solicitudTramiteId" = s.id
    LEFT JOIN "Clientes" c ON c.id = s."clienteId"
    LEFT JOIN LATERAL (
      SELECT MAX(et."createdAt") AS fecha FROM "EstadosTramites" et WHERE et."solicitudTramiteId" = s.id
    ) u ON true
    WHERE COALESCE(e."nombreEstado", '') <> :desistido
      AND s.id <> :excluirId
      AND (${[p ? `s.id IN (SELECT pt.solicitud_tramite_id FROM solicitud_tramite_placas pt WHERE pt.placa IN (:placa))` : null, m ? `UPPER(TRIM(s."matriculaInmobiliaria")) = :matricula` : null].filter(Boolean).join(' OR ')})
    ORDER BY s.id DESC
    LIMIT 30
  `, {
    type: QueryTypes.SELECT,
    transaction: transaction ?? undefined,
    replacements: { tiposEnvio: TIPOS_ENVIO, finalizado: FINALIZADO, desistido: DESISTIDO, placa: p, matricula: m, excluirId: excluirId ?? 0 }
  })
}

// ── Estado de las condiciones ──

export type GastoDelTramite = { codigo: string, estado: string, pagado: boolean, fechaPago: string | null }

export type EstadoDependencia = {
  dependeEnvio: boolean
  envio: EnvioRelacionable | null
  envioFinalizado: boolean
  gastos: GastoDelTramite[]
  pagoCompleto: boolean
  pagadoEl: string | null // último pago (YYYY-MM-DD)
  cumplidas: boolean // las dos condiciones, hoy
  cumplidasEn: string | null // ISO: cuándo quedó liberado
  puedeProgramar: boolean
  faltantes: string[]
}

const gastosDelTramite = (solicitudTramiteId: number, transaction?: Transaction | null) =>
  db.query<GastoDelTramite & { codigoEstado: string }>(`
    SELECT gs.codigo, eg.nombre AS estado, eg.codigo AS "codigoEstado",
      NOT (eg.codigo IN (:sinPagar)) AS pagado, gs.fecha_pago::text AS "fechaPago"
    FROM gastos_solicitudes gs
    JOIN gastos_estados_gasto eg ON eg.id = gs.estado_id
    WHERE gs.solicitud_tramite_id = :id AND eg.codigo <> 'ANULADO'
    ORDER BY gs.id
  `, { type: QueryTypes.SELECT, transaction: transaction ?? undefined, replacements: { id: solicitudTramiteId, sinPagar: GASTO_SIN_PAGAR } })

export const estadoDependencia = async (solicitudTramiteId: number, transaction?: Transaction | null): Promise<EstadoDependencia | null> => {
  const tramite = await SolicitudTramites.findByPk(solicitudTramiteId, {
    attributes: ['id', 'placa', 'matriculaInmobiliaria', 'dependeEnvio', 'envioTramiteId', 'condicionesEnvioCumplidasEn'],
    transaction: transaction ?? undefined
  })
  if (!tramite) return null

  const gastos = (await gastosDelTramite(tramite.id, transaction)).map(({ codigoEstado, ...g }) => g)
  // Sin gastos no hay nada por pagar (every de una lista vacía es true)
  const pagoCompleto = gastos.every(g => g.pagado)
  const pagadoEl = gastos.map(g => g.fechaPago).filter((f): f is string => Boolean(f)).sort().at(-1) ?? null

  let envio: EnvioRelacionable | null = null
  if (tramite.envioTramiteId) {
    // El envío relacionado, aunque ya no comparta la placa (se busca por su id)
    const [fila] = await db.query<EnvioRelacionable>(`
      SELECT s.id, tr."nombreTramite" AS tipo, COALESCE(e."nombreEstado", 'Sin Iniciar') AS estado,
        COALESCE(e."nombreEstado" = :finalizado, false) AS finalizado,
        CASE WHEN e."nombreEstado" = :finalizado
          THEN to_char(COALESCE(p."fechaFinalizacionServicio", (SELECT MAX(et."createdAt") FROM "EstadosTramites" et WHERE et."solicitudTramiteId" = s.id)) AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') END AS "finalizadoEl",
        to_char(s."createdAt" AT TIME ZONE 'America/Bogota', 'YYYY-MM-DD') AS "creadoEl",
        c."nombreCliente" AS cliente
      FROM "SolicitudTramites" s
      LEFT JOIN "Tramites" tr ON tr.id = s."tramiteId"
      LEFT JOIN "Estados" e ON e.id = s."estadoActualTramite"
      LEFT JOIN "Programacion" p ON p."solicitudTramiteId" = s.id
      LEFT JOIN "Clientes" c ON c.id = s."clienteId"
      WHERE s.id = :id
    `, { type: QueryTypes.SELECT, transaction: transaction ?? undefined, replacements: { id: tramite.envioTramiteId, finalizado: FINALIZADO } })
    envio = fila ?? null
  }
  const envioFinalizado = Boolean(envio?.finalizado)

  const faltantes: string[] = []
  if (tramite.dependeEnvio) {
    if (!envio) faltantes.push('relacionar el envío de documentos')
    else if (!envioFinalizado) faltantes.push(`que el envío #${envio.id} esté Finalizado (está ${envio.estado})`)
    const sinPagar = gastos.filter(g => !g.pagado)
    if (sinPagar.length) faltantes.push(`pagar ${sinPagar.length === 1 ? `el gasto ${sinPagar[0].codigo}` : `${sinPagar.length} gastos (${sinPagar.map(g => g.codigo).join(', ')})`}`)
  }

  const cumplidas = envioFinalizado && pagoCompleto
  const cumplidasEn = tramite.condicionesEnvioCumplidasEn ? new Date(tramite.condicionesEnvioCumplidasEn).toISOString() : null
  return {
    dependeEnvio: Boolean(tramite.dependeEnvio),
    envio,
    envioFinalizado,
    gastos,
    pagoCompleto,
    pagadoEl,
    cumplidas,
    cumplidasEn,
    puedeProgramar: !tramite.dependeEnvio || Boolean(cumplidasEn),
    faltantes
  }
}

// ── Validar lo que llega del formulario ──

// Normaliza { dependeEnvio, envioTramiteId } del cuerpo de la petición (crear o editar). Devuelve
// undefined si el formulario no los trae (así editar desde otro lado no toca la dependencia).
export const datosDependencia = async (
  body: { dependeEnvio?: unknown, envioTramiteId?: unknown },
  tramite: { id?: number | null, placa?: unknown, matriculaInmobiliaria?: unknown }
): Promise<{ dependeEnvio: boolean, envioTramiteId: number | null } | undefined> => {
  if (body.dependeEnvio === undefined) return undefined
  const dependeEnvio = body.dependeEnvio === true || body.dependeEnvio === 'true' || body.dependeEnvio === 'si'
  if (!dependeEnvio) return { dependeEnvio: false, envioTramiteId: null }

  if (!clave(tramite.placa) && !clave(tramite.matriculaInmobiliaria)) {
    throw new ErrorGastos('Para depender de un envío de documentos el trámite debe tener placa o matrícula')
  }
  const envioTramiteId = Number(body.envioTramiteId) > 0 ? Number(body.envioTramiteId) : null
  if (envioTramiteId) {
    const envios = await enviosRelacionables({ placa: tramite.placa, matricula: tramite.matriculaInmobiliaria, excluirId: tramite.id ?? null })
    if (!envios.some(e => e.id === envioTramiteId)) {
      throw new ErrorGastos(`El trámite #${envioTramiteId} no es un envío de documentos de esta placa o matrícula`)
    }
  }
  return { dependeEnvio: true, envioTramiteId }
}

// ── Historial ──

const anotar = async (solicitudTramiteId: number, seccion: string, cambios: CambioCampo[], contexto: ContextoPeticion, accion = 'MODIFICADO') => {
  try {
    await HistorialTramite.create({
      solicitudTramiteId,
      seccion,
      accion,
      registroId: null,
      cambios,
      usuarioId: contexto.usuarioId,
      tramitadorId: contexto.tramitadorId,
      nombreUsuario: contexto.nombre,
      origen: contexto.origen
    })
  } catch (error) {
    // El historial nunca frena la operación que lo generó
    console.error('❌ Historial de la dependencia del envío:', error)
  }
}

// Crear el trámite no pasa por la bitácora (el trámite guarda quién y cuándo): la dependencia
// marcada al crear se anota aquí
export const anotarDependenciaAlCrear = async (solicitudTramiteId: number, envioTramiteId: number | null) => {
  let envio = 'Por relacionar'
  if (envioTramiteId) {
    const [fila] = await db.query<{ tipo: string | null }>(`
      SELECT tr."nombreTramite" AS tipo FROM "SolicitudTramites" s LEFT JOIN "Tramites" tr ON tr.id = s."tramiteId" WHERE s.id = :id
    `, { type: QueryTypes.SELECT, replacements: { id: envioTramiteId } })
    envio = `#${envioTramiteId}${fila?.tipo ? ` · ${fila.tipo}` : ''}`
  }
  await anotar(solicitudTramiteId, 'DEPENDENCIA', [
    { campo: 'Depende de envío de documentos', antes: null, despues: 'Sí' },
    { campo: 'Envío relacionado', antes: null, despues: envio }
  ], contextoActual(), 'CREADO')
}

// Revisa si ya se cumplieron envío y pago; si sí, libera el trámite (una sola vez) y lo anota
export const revisarCondiciones = async (solicitudTramiteId: number, contexto: ContextoPeticion = contextoActual()) => {
  const estado = await estadoDependencia(solicitudTramiteId)
  if (!estado?.dependeEnvio || estado.cumplidasEn || !estado.cumplidas) return estado
  // Solo si sigue sin fecha (dos revisiones a la vez no la escriben dos veces)
  const [, filas] = await db.query(`
    UPDATE "SolicitudTramites" SET "condicionesEnvioCumplidasEn" = NOW()
    WHERE id = :id AND "dependeEnvio" AND "condicionesEnvioCumplidasEn" IS NULL
  `, { replacements: { id: solicitudTramiteId } })
  if ((filas as { rowCount?: number })?.rowCount) {
    await anotar(solicitudTramiteId, 'CONDICIONES', [
      { campo: `Envío #${estado.envio!.id}`, antes: null, despues: `Finalizado${estado.envio!.finalizadoEl ? ` el ${textoFecha(estado.envio!.finalizadoEl)}` : ''}` },
      { campo: 'Pago de los gastos', antes: null, despues: estado.gastos.length ? `Pagado${estado.pagadoEl ? ` el ${textoFecha(estado.pagadoEl)}` : ''}` : 'Sin gastos' }
    ], contexto)
  }
  return estadoDependencia(solicitudTramiteId)
}

// Al arrancar: libera los que ya cumplen y no tienen fecha de liberación (ej. los que quedaron
// esperando un gasto antes del cambio del 2026-11-10). Idempotente: los liberados no se vuelven a tocar.
export const liberarDependientesCumplidos = async () => {
  const pendientes = await SolicitudTramites.findAll({
    where: { dependeEnvio: true, condicionesEnvioCumplidasEn: null },
    attributes: ['id']
  })
  const liberados: number[] = []
  for (const { id } of pendientes) {
    const estado = await revisarCondiciones(id) // fuera de una petición queda como "Sistema"
    if (estado?.cumplidasEn) liberados.push(id)
  }
  return liberados
}

// ── Guardia: no se pone la fecha de diligencia a un trámite bloqueado ──

const dia = (valor: unknown) => {
  if (!valor) return null
  const fecha = new Date(valor as string)
  return isNaN(fecha.getTime()) ? String(valor).slice(0, 10) : fecha.toISOString().slice(0, 10)
}

export const mensajeBloqueo = (solicitudTramiteId: number, faltantes: string[]) =>
  `El trámite #${solicitudTramiteId} depende del envío de documentos y todavía no se puede programar: falta ${faltantes.join(' y ')}`

// Lanza ErrorGastos(409) si el trámite depende de un envío y aún no está liberado
export const exigirPuedeProgramar = async (solicitudTramiteId: number, transaction?: Transaction | null) => {
  const estado = await estadoDependencia(solicitudTramiteId, transaction)
  if (estado && !estado.puedeProgramar) throw new ErrorGastos(mensajeBloqueo(solicitudTramiteId, estado.faltantes), 409)
}

const guardiaProgramacion = async (programacion: Model, opciones: { transaction?: Transaction | null }) => {
  const nueva = dia(programacion.get('fechaProbableEntrega'))
  if (!nueva) return // borrar la fecha o no tenerla siempre se puede
  if (!programacion.isNewRecord && nueva === dia(programacion.previous('fechaProbableEntrega' as never))) return
  await exigirPuedeProgramar(Number(programacion.get('solicitudTramiteId')), opciones.transaction)
}

// ── Movimientos del envío y de los gastos → historial y revisión ──

const nombreEstado = async (estadoId: number | null | undefined) => {
  if (!estadoId) return null
  const [fila] = await db.query<{ nombre: string }>(`SELECT "nombreEstado" AS nombre FROM "Estados" WHERE id = :id`, { type: QueryTypes.SELECT, replacements: { id: estadoId } })
  return fila?.nombre ?? null
}

const nombreEstadoGasto = async (estadoId: number | null | undefined) => {
  if (!estadoId) return null
  const [fila] = await db.query<{ nombre: string }>(`SELECT nombre FROM gastos_estados_gasto WHERE id = :id`, { type: QueryTypes.SELECT, replacements: { id: estadoId } })
  return fila?.nombre ?? null
}

const despuesDeConfirmar = (opciones: { transaction?: Transaction | null }, fn: () => Promise<void>) => {
  const correr = () => { void fn().catch(error => console.error('❌ Dependencia del envío:', error)) }
  if (opciones.transaction) opciones.transaction.afterCommit(correr)
  else correr()
}

// Un estado nuevo del envío: se anota en cada trámite que depende de él y se revisan sus condiciones
const alCambiarEstadoDelEnvio = (registro: EstadosTramites, opciones: { transaction?: Transaction | null }) => {
  const envioId = Number(registro.solicitudTramiteId)
  const contexto = contextoActual()
  despuesDeConfirmar(opciones, async () => {
    const dependientes = await SolicitudTramites.findAll({ where: { envioTramiteId: envioId, dependeEnvio: true }, attributes: ['id'] })
    if (!dependientes.length) return
    // El estado anterior es el registro previo de ese envío
    const [anterior] = await db.query<{ estadoId: number }>(`
      SELECT "estadoId" FROM "EstadosTramites" WHERE "solicitudTramiteId" = :envioId AND id <> :id
      ORDER BY "createdAt" DESC, id DESC LIMIT 1
    `, { type: QueryTypes.SELECT, replacements: { envioId, id: registro.id } })
    const [antes, despues] = await Promise.all([nombreEstado(anterior?.estadoId), nombreEstado(registro.estadoId)])
    for (const d of dependientes) {
      await anotar(d.id, 'ENVIO', [{ campo: `Estado del envío #${envioId}`, antes: antes ?? 'Sin Iniciar', despues }], contexto)
      await revisarCondiciones(d.id, contexto)
    }
  })
}

// Un gasto nuevo, que cambia de estado o de trámite: se anota en el trámite (si depende) y se revisa
const alCambiarGasto = (nuevo: boolean) => (gasto: SolicitudesGasto, opciones: { transaction?: Transaction | null }) => {
  const cambioTramite = !nuevo && gasto.changed('solicitudTramiteId')
  if (!nuevo && !gasto.changed('estadoId') && !cambioTramite) return
  const tramiteId = gasto.solicitudTramiteId ? Number(gasto.solicitudTramiteId) : null
  const tramiteAnterior = cambioTramite ? Number(gasto.previous('solicitudTramiteId' as never)) || null : null
  // Si llegó de otro trámite, en este se anota como nuevo
  const estadoAnterior = nuevo || cambioTramite ? null : Number(gasto.previous('estadoId' as never)) || null
  const estadoActual = gasto.estadoId
  const codigo = gasto.codigo
  const contexto = contextoActual()
  despuesDeConfirmar(opciones, async () => {
    const ids = [tramiteId, tramiteAnterior].filter((id): id is number => Boolean(id))
    if (!ids.length) return
    const dependientes = await SolicitudTramites.findAll({ where: { id: ids, dependeEnvio: true }, attributes: ['id'] })
    if (!dependientes.length) return
    const [antes, despues] = await Promise.all([nombreEstadoGasto(estadoAnterior), nombreEstadoGasto(estadoActual)])
    for (const d of dependientes) {
      const cambio: CambioCampo = d.id === tramiteId
        ? { campo: `Gasto ${codigo}`, antes, despues }
        : { campo: `Gasto ${codigo}`, antes: despues, despues: `Pasó al trámite #${tramiteId ?? '—'}` }
      await anotar(d.id, 'PAGO', [cambio], contexto)
      await revisarCondiciones(d.id, contexto)
    }
  })
}

// Al cambiar la marca o el envío relacionado, el trámite vuelve a revisarse desde cero
const alCambiarDependencia = (tramite: SolicitudTramites) => {
  if (!tramite.changed('dependeEnvio') && !tramite.changed('envioTramiteId')) return
  if (!tramite.dependeEnvio) tramite.envioTramiteId = null
  tramite.condicionesEnvioCumplidasEn = null
}

const revisarDespuesDeGuardar = (tramite: SolicitudTramites, opciones: { transaction?: Transaction | null }) => {
  if (!tramite.dependeEnvio || tramite.condicionesEnvioCumplidasEn) return
  const id = tramite.id
  const contexto = contextoActual()
  despuesDeConfirmar(opciones, async () => { await revisarCondiciones(id, contexto) })
}

type ConHooks = { addHook: (evento: string, nombre: string, fn: (...args: any[]) => unknown) => unknown }

let activo = false

// Se llama al arrancar el backend (server.ts), junto con el historial
export const activarDependenciaEnvio = () => {
  if (activo) return
  activo = true

  const programacion = Programacion as unknown as ConHooks
  programacion.addHook('beforeCreate', 'dependenciaEnvio', guardiaProgramacion)
  programacion.addHook('beforeUpdate', 'dependenciaEnvio', guardiaProgramacion)
  // upsert no pasa por beforeCreate/beforeUpdate
  programacion.addHook('beforeUpsert', 'dependenciaEnvio', async (valores: Record<string, unknown>, opciones: { transaction?: Transaction | null }) => {
    if (!valores?.fechaProbableEntrega || !valores.solicitudTramiteId) return
    const actual = await Programacion.findOne({ where: { solicitudTramiteId: Number(valores.solicitudTramiteId) }, attributes: ['fechaProbableEntrega'], transaction: opciones.transaction ?? undefined })
    if (dia(actual?.fechaProbableEntrega) === dia(valores.fechaProbableEntrega)) return
    await exigirPuedeProgramar(Number(valores.solicitudTramiteId), opciones.transaction)
  })

  const tramite = SolicitudTramites as unknown as ConHooks
  tramite.addHook('beforeSave', 'dependenciaEnvio', alCambiarDependencia)
  tramite.addHook('afterSave', 'dependenciaEnvio', revisarDespuesDeGuardar)

  ;(EstadosTramites as unknown as ConHooks).addHook('afterCreate', 'dependenciaEnvio', alCambiarEstadoDelEnvio)

  const gasto = SolicitudesGasto as unknown as ConHooks
  gasto.addHook('afterCreate', 'dependenciaEnvio', alCambiarGasto(true))
  gasto.addHook('afterUpdate', 'dependenciaEnvio', alCambiarGasto(false))
  // Los cambios de estado en bloque (lotes de pago) también pasan por aquí
  gasto.addHook('beforeBulkUpdate', 'dependenciaEnvio', (o: { individualHooks?: boolean }) => { o.individualHooks = true })
}
