import { QueryTypes, type Transaction } from 'sequelize'
import { db } from '../../config/db'
import Tramitador from '../../models/tramitador'
import ReservaAgenda, { ESTADOS_RESERVA, HORA_FIN_DIA, HORA_INICIO_DIA, TIPOS_RESERVA, type TipoReserva } from '../../models/mensajeria/reservaAgenda'
import SolicitudTramites from '../../models/solicitudTramites'
import Programacion from '../../models/programacion'
import { ErrorGastos } from '../gastos/errores'
import { notificarProgramacion } from '../notificacionesProgramacion'
import { hoyBogota } from './rutas'

// =====================================
// AGENDA DE LOS MENSAJEROS (Nodex Trámites → Agenda de mensajeros)
// Por día (la fecha de diligencia, como en Rutas) y mensajero: las citas con su hora, los
// trámites sin hora, las reservas de espacio y los "No disponible" del mensajero.
// Regla del usuario: un horario ocupado no se puede volver a ocupar. Las citas y las reservas
// activas del mismo mensajero y día no se cruzan; se revisa en cada lugar que cambia la hora,
// la fecha o el mensajero de un trámite con cita, y al reservar.
// =====================================

// Sin hora final, la cita cuenta como una hora (decisión del usuario)
export const DURACION_CITA_SIN_FIN = 60
// Carga del mensajero: diligencias por día que se consideran su capacidad (decisión del usuario)
export const CAPACIDAD_DIA = 6
const ESTADO_DESISTIDO = 5
const ESTADO_FINALIZADO = 6

// "08:30" o "08:30:00" → minutos del día
export const aMinutos = (hora: string) => {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}
export const aHora = (minutos: number) => `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
const horaValida = (hora: unknown): hora is string => typeof hora === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(hora)

// Fecha de diligencia en YYYY-MM-DD: se guarda como medianoche UTC del día programado
const diaDe = (fecha: Date | string | null | undefined) => {
  if (!fecha) return null
  if (typeof fecha === 'string') return /^\d{4}-\d{2}-\d{2}/.test(fecha) ? fecha.slice(0, 10) : null
  return isNaN(fecha.getTime()) ? null : fecha.toISOString().slice(0, 10)
}

type Ocupado = { inicio: number, fin: number, descripcion: string, tramiteId: number | null, reservaId: number | null }

// Un mensajero y un día a la vez: dos citas o reservas guardadas al mismo tiempo no se cruzan
const bloquearAgenda = (tramitadorId: number, fecha: string, transaction: Transaction) =>
  db.query(`SELECT pg_advisory_xact_lock(hashtext(:clave))`, { replacements: { clave: `agenda:${tramitadorId}:${fecha}` }, transaction })

// Lo que ocupa el día del mensajero: citas con hora (sin los desistidos) y reservas activas
const ocupadoDelDia = async (tramitadorId: number, fecha: string, transaction?: Transaction): Promise<Ocupado[]> => {
  const citas = await db.query<{ id: number, horaCita: string, horaFinCita: string | null }>(`
    SELECT s.id, p."horaCita"::text AS "horaCita", p."horaFinCita"::text AS "horaFinCita"
    FROM "SolicitudTramites" s
    JOIN "Programacion" p ON p."solicitudTramiteId" = s.id
    WHERE s."tramitadorId" = :tramitadorId
      AND (p."fechaProbableEntrega" AT TIME ZONE 'UTC')::date = CAST(:fecha AS DATE)
      AND p."requiereCita" AND p."horaCita" IS NOT NULL
      AND COALESCE(s."estadoActualTramite", 0) <> :desistido
  `, { type: QueryTypes.SELECT, replacements: { tramitadorId, fecha, desistido: ESTADO_DESISTIDO }, transaction })
  const reservas = await ReservaAgenda.findAll({ where: { tramitadorId, fecha, estado: ESTADOS_RESERVA.ACTIVA }, transaction })
  return [
    ...citas.map(c => {
      const inicio = aMinutos(c.horaCita)
      return { inicio, fin: finDeCita(inicio, c.horaFinCita), descripcion: `la cita del trámite #${c.id}`, tramiteId: c.id, reservaId: null }
    }),
    ...reservas.map(r => ({
      inicio: aMinutos(r.horaInicio),
      fin: aMinutos(r.horaFin),
      descripcion: r.tipo === TIPOS_RESERVA.NO_DISPONIBLE
        ? `no está disponible (${r.motivo})${r.diaCompleto ? ' todo el día' : ''}`
        : `la reserva "${r.motivo}"${r.solicitudTramiteId ? ` (trámite #${r.solicitudTramiteId})` : ''}`,
      tramiteId: r.solicitudTramiteId,
      reservaId: r.id
    }))
  ]
}

const finDeCita = (inicio: number, horaFin: string | null) =>
  horaFin && aMinutos(horaFin) > inicio ? aMinutos(horaFin) : Math.min(inicio + DURACION_CITA_SIN_FIN, 24 * 60)

// Lanza 409 si [inicio, fin) se cruza con algo del día. `deEsteTramite` excluye la propia cita
// y las reservas hechas para ese trámite (la cita puede ocupar el espacio que se le reservó).
const exigirFranjaLibre = async (
  tramitadorId: number, fecha: string, inicio: number, fin: number,
  { deEsteTramite }: { deEsteTramite?: number }, transaction: Transaction
) => {
  const cruce = (await ocupadoDelDia(tramitadorId, fecha, transaction))
    .filter(o => !(deEsteTramite && o.tramiteId === deEsteTramite))
    .find(o => inicio < o.fin && o.inicio < fin)
  if (cruce) {
    throw new ErrorGastos(`El mensajero ya tiene ocupado de ${aHora(cruce.inicio)} a ${aHora(cruce.fin)} el ${fecha}: ${cruce.descripcion}`, 409)
  }
}

type CambiosCita = {
  tramitadorId?: number | null
  fecha?: Date | string | null
  requiereCita?: boolean
  horaCita?: string | null
  horaFinCita?: string | null
}

// Revisa la cita del trámite con los cambios que se van a guardar (los que no vienen se toman de
// lo guardado). Solo aplica a mensajeros con cita y hora. Debe llamarse dentro de la transacción
// que guarda el cambio, para que el bloqueo valga hasta el final.
export const verificarCitaDelTramite = async (tramiteId: number, cambios: CambiosCita, transaction: Transaction) => {
  const [actual] = await db.query<{ tramitadorId: number | null, fecha: string | null, requiereCita: boolean | null, horaCita: string | null, horaFinCita: string | null }>(`
    SELECT s."tramitadorId", to_char((p."fechaProbableEntrega" AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS fecha,
      p."requiereCita", p."horaCita"::text AS "horaCita", p."horaFinCita"::text AS "horaFinCita"
    FROM "SolicitudTramites" s
    LEFT JOIN "Programacion" p ON p."solicitudTramiteId" = s.id
    WHERE s.id = :tramiteId
  `, { type: QueryTypes.SELECT, replacements: { tramiteId }, transaction })
  if (!actual) return

  const valor = <K extends keyof CambiosCita>(clave: K, guardado: CambiosCita[K]) => (clave in cambios ? cambios[clave] : guardado)
  const tramitadorId = valor('tramitadorId', actual.tramitadorId)
  const fecha = diaDe(valor('fecha', actual.fecha))
  const requiereCita = Boolean(valor('requiereCita', actual.requiereCita ?? false))
  const horaCita = valor('horaCita', actual.horaCita)
  const horaFinCita = valor('horaFinCita', actual.horaFinCita)
  if (!tramitadorId || !fecha || !requiereCita || !horaValida(horaCita)) return

  const mensajero = await Tramitador.findByPk(Number(tramitadorId), { attributes: ['esMensajero'], transaction })
  if (!mensajero?.esMensajero) return

  const inicio = aMinutos(horaCita)
  await bloquearAgenda(Number(tramitadorId), fecha, transaction)
  await exigirFranjaLibre(Number(tramitadorId), fecha, inicio, finDeCita(inicio, horaValida(horaFinCita) ? horaFinCita : null), { deEsteTramite: tramiteId }, transaction)
}

// Al programar la cita del trámite, sus reservas activas ya cumplieron
export const cerrarReservasDelTramite = (tramiteId: number, transaction: Transaction) =>
  ReservaAgenda.update(
    { estado: ESTADOS_RESERVA.CERRADA, cerradaEn: new Date() },
    { where: { solicitudTramiteId: tramiteId, estado: ESTADOS_RESERVA.ACTIVA }, transaction }
  )

// Hora final de la cita: opcional, pero si viene debe ser después de la hora de inicio
export const validarHorasCita = (datos: { requiereCita?: unknown, horaCita?: unknown, horaFinCita?: unknown }) => {
  if (!datos.requiereCita) return
  if (datos.horaFinCita && !horaValida(datos.horaFinCita)) throw new ErrorGastos('La hora final de la cita no es válida')
  if (datos.horaFinCita && !datos.horaCita) throw new ErrorGastos('Indique la hora de la cita antes de la hora final')
  if (horaValida(datos.horaCita) && horaValida(datos.horaFinCita) && aMinutos(datos.horaFinCita) <= aMinutos(datos.horaCita)) {
    throw new ErrorGastos('La hora final de la cita debe ser posterior a la hora de inicio')
  }
}

// ── Consulta de la agenda ──

type FilaTramite = {
  id: number
  tramitadorId: number
  horaCita: string | null
  horaFinCita: string | null
  requiereCita: boolean | null
  fechaCita: string | null
  tramite: string | null
  placa: string | null
  municipio: string | null
  direccion: string | null
  estado: string | null
}

export const agendaDelDia = async (fecha: string, sedeId: number | undefined, usuario: { id: number, esTorreControl: boolean }) => {
  const mensajeros = await Tramitador.findAll({
    where: { esMensajero: true, activo: true, ...(sedeId ? { sedeId } : {}) },
    attributes: ['id', 'nombreTramitador', 'sedeId'],
    order: [['nombreTramitador', 'ASC']]
  })
  const ids = mensajeros.map(m => m.id)
  // Contador del botón "Sin mensajero" (solo Torre de control lo ve)
  const sinMensajero = usuario.esTorreControl ? await contarSinMensajero() : null
  if (ids.length === 0) return { fecha, hoy: hoyBogota(), duracionSinFin: DURACION_CITA_SIN_FIN, capacidad: CAPACIDAD_DIA, sinMensajero, mensajeros: [] }

  const [tramites, reservas, sedes] = await Promise.all([
    db.query<FilaTramite>(`
      SELECT s.id, s."tramitadorId", p."horaCita"::text AS "horaCita", p."horaFinCita"::text AS "horaFinCita", p."requiereCita",
        to_char(p."fechaCita", 'YYYY-MM-DD') AS "fechaCita", t."nombreTramite" AS tramite,
        COALESCE(s.placa, s."matriculaInmobiliaria") AS placa, m."nombreMunicipio" AS municipio, s."direccionTramite" AS direccion,
        e."nombreEstado" AS estado
      FROM "SolicitudTramites" s
      JOIN "Programacion" p ON p."solicitudTramiteId" = s.id
      LEFT JOIN "Tramites" t ON t.id = s."tramiteId"
      LEFT JOIN "Municipios" m ON m.id = s."municipiosId"
      LEFT JOIN "Estados" e ON e.id = s."estadoActualTramite"
      WHERE s."tramitadorId" IN (:ids)
        AND (p."fechaProbableEntrega" AT TIME ZONE 'UTC')::date = CAST(:fecha AS DATE)
        AND COALESCE(s."estadoActualTramite", 0) <> :desistido
      ORDER BY p."horaCita" NULLS LAST, s.id
    `, { type: QueryTypes.SELECT, replacements: { ids, fecha, desistido: ESTADO_DESISTIDO } }),
    db.query<{ id: number, tramitadorId: number, horaInicio: string, horaFin: string, motivo: string, tipo: TipoReserva, diaCompleto: boolean, solicitudTramiteId: number | null, creadaPor: number, creador: string | null, creadaEn: string }>(`
      SELECT r.id, r.tramitador_id AS "tramitadorId", r.hora_inicio::text AS "horaInicio", r.hora_fin::text AS "horaFin", r.motivo,
        r.tipo, r.dia_completo AS "diaCompleto",
        r.solicitud_tramite_id AS "solicitudTramiteId", r.creada_por AS "creadaPor", u."nombreUsuario" AS creador, r.created_at AS "creadaEn"
      FROM mensajeria_reservas r
      LEFT JOIN "Usuarios" u ON u.id = r.creada_por
      WHERE r.tramitador_id IN (:ids) AND r.fecha = CAST(:fecha AS DATE) AND r.estado = :activa
      ORDER BY r.hora_inicio
    `, { type: QueryTypes.SELECT, replacements: { ids, fecha, activa: ESTADOS_RESERVA.ACTIVA } }),
    db.query<{ id: number, nombre: string }>(`SELECT id, nombre FROM mensajeria_sedes`, { type: QueryTypes.SELECT })
  ])

  const corta = (hora: string) => hora.slice(0, 5)

  return {
    fecha,
    hoy: hoyBogota(),
    duracionSinFin: DURACION_CITA_SIN_FIN,
    capacidad: CAPACIDAD_DIA,
    sinMensajero,
    mensajeros: mensajeros.map(m => {
      const propios = tramites.filter(t => t.tramitadorId === m.id)
      const conHora = propios.filter(t => t.requiereCita && t.horaCita)
      return {
        id: m.id,
        nombre: m.nombreTramitador.trim(),
        sede: sedes.find(s => s.id === m.sedeId)?.nombre ?? null,
        citas: conHora.map(t => {
          const inicio = aMinutos(t.horaCita!)
          return {
            tramiteId: t.id,
            inicio: corta(t.horaCita!),
            fin: aHora(finDeCita(inicio, t.horaFinCita)),
            sinHoraFin: !t.horaFinCita,
            tramite: t.tramite,
            placa: t.placa,
            municipio: t.municipio,
            direccion: t.direccion,
            estado: t.estado ?? 'Sin iniciar',
            // La agenda va por la fecha de diligencia: aviso si la de la cita es otra
            fechaCitaDistinta: t.fechaCita && t.fechaCita !== fecha ? t.fechaCita : null
          }
        }),
        sinHora: propios.filter(t => !conHora.includes(t)).map(t => ({
          tramiteId: t.id,
          tramite: t.tramite,
          placa: t.placa,
          municipio: t.municipio,
          direccion: t.direccion,
          estado: t.estado ?? 'Sin iniciar',
          requiereCita: Boolean(t.requiereCita)
        })),
        reservas: reservas.filter(r => r.tramitadorId === m.id).map(r => ({
          id: r.id,
          inicio: corta(r.horaInicio),
          fin: corta(r.horaFin),
          motivo: r.motivo,
          tipo: r.tipo,
          diaCompleto: r.diaCompleto,
          tramiteId: r.solicitudTramiteId,
          creadaPor: r.creador ?? '',
          creadaEn: r.creadaEn,
          puedeCancelar: usuario.esTorreControl || r.creadaPor === usuario.id
        }))
      }
    })
  }
}

// ── Reservas ──

// Reserva de espacio o "No disponible" del mensajero (este solo lo marca Torre de control; puede
// ser de todo el día, que se guarda de 00:00 a 23:59 para que choque con todo lo del día)
export const crearReserva = async (
  datos: {
    tramitadorId: number, fecha: string, horaInicio?: string, horaFin?: string, motivo: string,
    solicitudTramiteId?: number | null, tipo?: TipoReserva, diaCompleto?: boolean
  },
  usuario: { id: number, esTorreControl: boolean }
) => {
  const tipo = datos.tipo ?? TIPOS_RESERVA.RESERVA
  const noDisponible = tipo === TIPOS_RESERVA.NO_DISPONIBLE
  if (noDisponible && !usuario.esTorreControl) throw new ErrorGastos('Solo Torre de control marca a un mensajero como no disponible', 403)
  if (datos.diaCompleto && !noDisponible) throw new ErrorGastos('Solo "No disponible" puede ser de todo el día')
  if (noDisponible && datos.solicitudTramiteId) throw new ErrorGastos('"No disponible" no va atado a un trámite')

  const motivo = datos.motivo.trim()
  if (!motivo) throw new ErrorGastos(noDisponible ? 'Indique el motivo' : 'Indique el motivo de la reserva')
  if (datos.fecha < hoyBogota()) throw new ErrorGastos('No se puede reservar un día que ya pasó')
  const horaInicio = datos.diaCompleto ? HORA_INICIO_DIA : datos.horaInicio
  const horaFin = datos.diaCompleto ? HORA_FIN_DIA : datos.horaFin
  if (!horaValida(horaInicio) || !horaValida(horaFin)) throw new ErrorGastos('Indique la hora de inicio y la hora final')
  const inicio = aMinutos(horaInicio)
  const fin = aMinutos(horaFin)
  if (fin <= inicio) throw new ErrorGastos('La hora final debe ser posterior a la hora de inicio')

  const mensajero = await Tramitador.findByPk(datos.tramitadorId, { attributes: ['id', 'esMensajero', 'activo'] })
  if (!mensajero?.esMensajero || !mensajero.activo) throw new ErrorGastos('El mensajero no existe o no está activo', 404)

  return db.transaction(async transaction => {
    if (datos.solicitudTramiteId) {
      const [tramite] = await db.query<{ id: number, estado: number | null, cita: boolean }>(`
        SELECT s.id, s."estadoActualTramite" AS estado, COALESCE(p."requiereCita" AND p."horaCita" IS NOT NULL, false) AS cita
        FROM "SolicitudTramites" s LEFT JOIN "Programacion" p ON p."solicitudTramiteId" = s.id
        WHERE s.id = :id
      `, { type: QueryTypes.SELECT, replacements: { id: datos.solicitudTramiteId }, transaction })
      if (!tramite) throw new ErrorGastos(`El trámite #${datos.solicitudTramiteId} no existe`, 404)
      if (tramite.estado === ESTADO_DESISTIDO || tramite.estado === ESTADO_FINALIZADO) throw new ErrorGastos(`El trámite #${tramite.id} ya está cerrado`)
      if (tramite.cita) throw new ErrorGastos(`El trámite #${tramite.id} ya tiene la cita programada`)
    }

    await bloquearAgenda(datos.tramitadorId, datos.fecha, transaction)
    await exigirFranjaLibre(datos.tramitadorId, datos.fecha, inicio, fin, {}, transaction)
    const reserva = await ReservaAgenda.create({
      tramitadorId: datos.tramitadorId,
      fecha: datos.fecha,
      horaInicio,
      horaFin,
      motivo,
      tipo,
      diaCompleto: Boolean(datos.diaCompleto),
      solicitudTramiteId: datos.solicitudTramiteId || null,
      creadaPor: usuario.id
    }, { transaction })
    return { id: reserva.id }
  })
}

// La cancela quien la creó o Torre de control
export const cancelarReserva = async (id: number, usuario: { id: number, esTorreControl: boolean }) => {
  const reserva = await ReservaAgenda.findByPk(id)
  if (!reserva) throw new ErrorGastos('La reserva no existe', 404)
  if (!usuario.esTorreControl && reserva.creadaPor !== usuario.id) throw new ErrorGastos('Solo quien hizo la reserva o Torre de control pueden cancelarla', 403)
  if (reserva.estado !== ESTADOS_RESERVA.ACTIVA) throw new ErrorGastos('La reserva ya no está activa')
  await reserva.update({ estado: ESTADOS_RESERVA.CANCELADA, canceladaPor: usuario.id, canceladaEn: new Date() })
  return reserva.tipo
}


// ── Bandeja: trámites sin mensajero (Torre de control) ──

const contarSinMensajero = async () => {
  const [fila] = await db.query<{ total: string }>(`
    SELECT count(*) AS total FROM "SolicitudTramites"
    WHERE "tramitadorId" IS NULL AND COALESCE("estadoActualTramite", 0) NOT IN (:cerrados)
  `, { type: QueryTypes.SELECT, replacements: { cerrados: [ESTADO_DESISTIDO, ESTADO_FINALIZADO] } })
  return Number(fila?.total ?? 0)
}

// Abiertos y sin tramitador asignado; primero los que requieren cita y los de diligencia más próxima
export const tramitesSinMensajero = (busqueda: string) => {
  const texto = busqueda.trim()
  const numero = /^#?\d+$/.test(texto) ? Number(texto.replace('#', '')) : null
  return db.query<{
    id: number, tramite: string | null, placa: string | null, municipio: string | null, direccion: string | null,
    cliente: string | null, estado: string | null, requiereCita: boolean, fechaDiligencia: string | null
  }>(`
    SELECT s.id, t."nombreTramite" AS tramite, COALESCE(s.placa, s."matriculaInmobiliaria") AS placa,
      m."nombreMunicipio" AS municipio, s."direccionTramite" AS direccion, c."nombreCliente" AS cliente,
      COALESCE(e."nombreEstado", 'Sin iniciar') AS estado, COALESCE(p."requiereCita", false) AS "requiereCita",
      to_char((p."fechaProbableEntrega" AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS "fechaDiligencia"
    FROM "SolicitudTramites" s
    LEFT JOIN "Programacion" p ON p."solicitudTramiteId" = s.id
    LEFT JOIN "Tramites" t ON t.id = s."tramiteId"
    LEFT JOIN "Municipios" m ON m.id = s."municipiosId"
    LEFT JOIN "Clientes" c ON c.id = s."clienteId"
    LEFT JOIN "Estados" e ON e.id = s."estadoActualTramite"
    WHERE s."tramitadorId" IS NULL
      AND COALESCE(s."estadoActualTramite", 0) NOT IN (:cerrados)
      ${texto ? `AND (${numero ? 's.id = :numero OR ' : ''}s.placa ILIKE :texto OR s."matriculaInmobiliaria" ILIKE :texto
        OR t."nombreTramite" ILIKE :texto OR m."nombreMunicipio" ILIKE :texto OR s."direccionTramite" ILIKE :texto)` : ''}
    ORDER BY COALESCE(p."requiereCita", false) DESC, p."fechaProbableEntrega" NULLS LAST, s.id DESC
    LIMIT 100
  `, { type: QueryTypes.SELECT, replacements: { cerrados: [ESTADO_DESISTIDO, ESTADO_FINALIZADO], numero, texto: `%${texto}%` } })
}

// Asigna el mensajero a un trámite sin tramitador y le programa la cita en el espacio elegido:
// fecha de diligencia y de la cita = el día de la agenda, con hora y hora final. Mismas reglas y
// avisos que asignar el tramitador y guardar la programación a mano.
export const asignarDesdeAgenda = async (datos: { tramiteId: number, tramitadorId: number, fecha: string, horaInicio: string, horaFin: string }) => {
  if (datos.fecha < hoyBogota()) throw new ErrorGastos('No se puede programar en un día que ya pasó')
  validarHorasCita({ requiereCita: true, horaCita: datos.horaInicio, horaFinCita: datos.horaFin })

  const mensajero = await Tramitador.findByPk(datos.tramitadorId, { attributes: ['id', 'esMensajero', 'activo'] })
  if (!mensajero?.esMensajero || !mensajero.activo) throw new ErrorGastos('El mensajero no existe o no está activo', 404)

  let avisarAsignado = false
  await db.transaction(async transaction => {
    const tramite = await SolicitudTramites.findByPk(datos.tramiteId, { attributes: ['id', 'tramitadorId', 'estadoActualTramite'], transaction })
    if (!tramite) throw new ErrorGastos(`El trámite #${datos.tramiteId} no existe`, 404)
    if (tramite.tramitadorId) throw new ErrorGastos(`El trámite #${tramite.id} ya tiene tramitador asignado`)
    if ([ESTADO_DESISTIDO, ESTADO_FINALIZADO].includes(Number(tramite.estadoActualTramite))) throw new ErrorGastos(`El trámite #${tramite.id} ya está cerrado`)

    const cita = { requiereCita: true, fechaCita: datos.fecha, horaCita: datos.horaInicio, horaFinCita: datos.horaFin }
    await verificarCitaDelTramite(tramite.id, { tramitadorId: datos.tramitadorId, fecha: datos.fecha, ...cita }, transaction)

    // Como la programación a mano: el aviso de asignado sale si la fecha de diligencia es nueva o posterior
    const programacion = await Programacion.findOne({ where: { solicitudTramiteId: tramite.id }, transaction })
    const anterior = programacion?.fechaProbableEntrega ?? null
    avisarAsignado = !anterior || new Date(datos.fecha).getTime() > new Date(anterior).getTime()
    if (programacion) await programacion.update({ fechaProbableEntrega: datos.fecha, ...cita }, { transaction })
    else await Programacion.create({ solicitudTramiteId: tramite.id, fechaProbableEntrega: datos.fecha, ...cita }, { transaction })

    tramite.tramitadorId = datos.tramitadorId
    await tramite.save({ transaction })
    await cerrarReservasDelTramite(tramite.id, transaction)
  })

  await notificarProgramacion(datos.tramiteId, { avisarAsignado })
}
