import { QueryTypes, type Transaction } from 'sequelize'
import { db } from '../../config/db'
import Tramitador from '../../models/tramitador'
import ReservaAgenda, { ESTADOS_RESERVA } from '../../models/mensajeria/reservaAgenda'
import { ErrorGastos } from '../gastos/errores'
import { hoyBogota } from './rutas'

// =====================================
// AGENDA DE LOS MENSAJEROS (Nodex Trámites → Agenda de mensajeros)
// Por día (la fecha de diligencia, como en Rutas) y mensajero: las citas con su hora, los
// trámites sin hora y las reservas de espacio de Gestión de activos.
// Regla del usuario: un horario ocupado no se puede volver a ocupar. Las citas y las reservas
// activas del mismo mensajero y día no se cruzan; se revisa en cada lugar que cambia la hora,
// la fecha o el mensajero de un trámite con cita, y al reservar.
// =====================================

// Sin hora final, la cita cuenta como una hora (decisión del usuario)
export const DURACION_CITA_SIN_FIN = 60
const ESTADO_DESISTIDO = 5

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
      descripcion: `la reserva "${r.motivo}"${r.solicitudTramiteId ? ` (trámite #${r.solicitudTramiteId})` : ''}`,
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
  estado: string | null
}

export const agendaDelDia = async (fecha: string, sedeId: number | undefined, usuario: { id: number, esTorreControl: boolean }) => {
  const mensajeros = await Tramitador.findAll({
    where: { esMensajero: true, activo: true, ...(sedeId ? { sedeId } : {}) },
    attributes: ['id', 'nombreTramitador', 'sedeId'],
    order: [['nombreTramitador', 'ASC']]
  })
  const ids = mensajeros.map(m => m.id)
  if (ids.length === 0) return { fecha, hoy: hoyBogota(), duracionSinFin: DURACION_CITA_SIN_FIN, mensajeros: [] }

  const [tramites, reservas, sedes] = await Promise.all([
    db.query<FilaTramite>(`
      SELECT s.id, s."tramitadorId", p."horaCita"::text AS "horaCita", p."horaFinCita"::text AS "horaFinCita", p."requiereCita",
        to_char(p."fechaCita", 'YYYY-MM-DD') AS "fechaCita", t."nombreTramite" AS tramite,
        COALESCE(s.placa, s."matriculaInmobiliaria") AS placa, m."nombreMunicipio" AS municipio, e."nombreEstado" AS estado
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
    db.query<{ id: number, tramitadorId: number, horaInicio: string, horaFin: string, motivo: string, solicitudTramiteId: number | null, creadaPor: number, creador: string | null, creadaEn: string }>(`
      SELECT r.id, r.tramitador_id AS "tramitadorId", r.hora_inicio::text AS "horaInicio", r.hora_fin::text AS "horaFin", r.motivo,
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
          estado: t.estado ?? 'Sin iniciar',
          requiereCita: Boolean(t.requiereCita)
        })),
        reservas: reservas.filter(r => r.tramitadorId === m.id).map(r => ({
          id: r.id,
          inicio: corta(r.horaInicio),
          fin: corta(r.horaFin),
          motivo: r.motivo,
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

export const crearReserva = async (
  datos: { tramitadorId: number, fecha: string, horaInicio: string, horaFin: string, motivo: string, solicitudTramiteId?: number | null },
  usuarioId: number
) => {
  const motivo = datos.motivo.trim()
  if (!motivo) throw new ErrorGastos('Indique el motivo de la reserva')
  if (datos.fecha < hoyBogota()) throw new ErrorGastos('No se puede reservar un día que ya pasó')
  const inicio = aMinutos(datos.horaInicio)
  const fin = aMinutos(datos.horaFin)
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
      if (tramite.estado === ESTADO_DESISTIDO || tramite.estado === 6) throw new ErrorGastos(`El trámite #${tramite.id} ya está cerrado`)
      if (tramite.cita) throw new ErrorGastos(`El trámite #${tramite.id} ya tiene la cita programada`)
    }

    await bloquearAgenda(datos.tramitadorId, datos.fecha, transaction)
    await exigirFranjaLibre(datos.tramitadorId, datos.fecha, inicio, fin, {}, transaction)
    const reserva = await ReservaAgenda.create({
      tramitadorId: datos.tramitadorId,
      fecha: datos.fecha,
      horaInicio: datos.horaInicio,
      horaFin: datos.horaFin,
      motivo,
      solicitudTramiteId: datos.solicitudTramiteId || null,
      creadaPor: usuarioId
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
}
