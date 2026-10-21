import { Op } from 'sequelize'
import { db } from '../../config/db'
import Tramitador from '../../models/tramitador'
import JornadaMensajero from '../../models/mensajeria/jornadaMensajero'
import PausaJornada from '../../models/mensajeria/pausaJornada'
import ParadaMensajeria, { ESTADOS_PARADA } from '../../models/mensajeria/paradaMensajeria'
import UbicacionMensajero from '../../models/mensajeria/ubicacionMensajero'
import { ErrorUbicacion } from './ubicacion'

// Día de Colombia (aquí y no desde rutas.ts, que importa este archivo)
const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

// =====================================
// RUTAS (JORNADAS) Y DILIGENCIAS DEL MENSAJERO (2026-10-21, PESV)
// El mensajero marca en su app el inicio y el fin de cada ruta (puede haber varias en el día),
// el almuerzo (pausa dentro de la ruta) y el inicio de cada diligencia (la confirmación de la
// visita es su fin). Así se mide el tiempo por ruta y por diligencia, y los km por GPS.
// Reglas: una ruta abierta a la vez; diligencias solo con la ruta abierta y fuera del almuerzo;
// una diligencia en curso a la vez; no se finaliza la ruta con una diligencia en curso.
// =====================================

type Gps = { latitud?: unknown, longitud?: unknown }

const coordenadas = ({ latitud, longitud }: Gps) => {
  const lat = Number(latitud), lng = Number(longitud)
  return latitud !== undefined && latitud !== null && latitud !== '' && Number.isFinite(lat) && Math.abs(lat) <= 90
    && Number.isFinite(lng) && Math.abs(lng) <= 180
    ? { latitud: lat, longitud: lng }
    : { latitud: null, longitud: null }
}

const mensajeroActivo = async (tramitadorId: number) => {
  const mensajero = await Tramitador.findByPk(tramitadorId, { attributes: ['id', 'esMensajero', 'activo'] })
  if (!mensajero?.esMensajero || !mensajero.activo) throw new ErrorUbicacion('No está registrado como mensajero', 403)
}

export const jornadaAbierta = (tramitadorId: number) =>
  JornadaMensajero.findOne({ where: { tramitadorId, fin: null }, include: [PausaJornada], order: [['inicio', 'DESC']] })

const pausaAbierta = (jornada: JornadaMensajero | null) => jornada?.pausas?.find(p => !p.fin) ?? null

const diligenciaEnCurso = (tramitadorId: number) =>
  ParadaMensajeria.findOne({ where: { tramitadorId, estado: ESTADOS_PARADA.PENDIENTE, inicioDiligencia: { [Op.ne]: null } } })

// ── Km por GPS ─────────────────────────────

const PRECISION_MAXIMA_M = 100     // posiciones menos precisas no cuentan
const MOVIMIENTO_MINIMO_M = 30     // por debajo es "temblor" del GPS con el mensajero quieto
const VELOCIDAD_MAXIMA_KMH = 120   // saltos más rápidos que esto son errores del GPS
const PICO_MINIMO_M = 500          // un "pico": se va lejos y la siguiente posición vuelve cerca

const metrosEntre = (a: { latitud: number, longitud: number }, b: { latitud: number, longitud: number }) => {
  const rad = (g: number) => (g * Math.PI) / 180
  const h = Math.sin(rad(b.latitud - a.latitud) / 2) ** 2
    + Math.cos(rad(a.latitud)) * Math.cos(rad(b.latitud)) * Math.sin(rad(b.longitud - a.longitud) / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h))
}

type Posicion = { latitud: number, longitud: number, precisionMetros: number | null, registradaEn: Date }

// Quita los picos de una sola posición (A → B lejos → C de vuelta cerca de A): son errores del GPS
const sinPicos = (posiciones: Posicion[]) => posiciones.filter((b, i) => {
  const a = posiciones[i - 1], c = posiciones[i + 1]
  if (!a || !c) return true
  const ab = metrosEntre(a, b), bc = metrosEntre(b, c)
  return !(ab > PICO_MINIMO_M && bc > PICO_MINIMO_M && metrosEntre(a, c) < Math.min(ab, bc) / 2)
})

// Suma las distancias entre posiciones consecutivas, desde la última aceptada: así el temblor del
// GPS en un mismo sitio no suma, y un tramo con la app cerrada se cuenta en línea recta.
export const kmDePosiciones = (todas: Posicion[]) => {
  const posiciones = sinPicos(todas.filter(p => p.precisionMetros === null || p.precisionMetros <= PRECISION_MAXIMA_M))
  let metros = 0
  let ancla: Posicion | null = null
  for (const p of posiciones) {
    if (!ancla) { ancla = p; continue }
    const distancia = metrosEntre(ancla, p)
    if (distancia < MOVIMIENTO_MINIMO_M) continue
    const horas = Math.max((p.registradaEn.getTime() - ancla.registradaEn.getTime()) / 3_600_000, 1 / 3600)
    if (distancia / 1000 / horas > VELOCIDAD_MAXIMA_KMH) continue
    metros += distancia
    ancla = p
  }
  return Math.round(metros / 10) / 100
}

const kmDeJornada = async (tramitadorId: number, inicio: Date, fin: Date) =>
  kmDePosiciones(await UbicacionMensajero.findAll({
    where: { tramitadorId, registradaEn: { [Op.between]: [inicio, fin] } },
    attributes: ['latitud', 'longitud', 'precisionMetros', 'registradaEn'],
    order: [['registradaEn', 'ASC']]
  }))

// ── Acciones de la app ─────────────────────

export const iniciarJornada = async (tramitadorId: number, gps: Gps) => {
  await mensajeroActivo(tramitadorId)
  if (await jornadaAbierta(tramitadorId)) throw new ErrorUbicacion('Ya tiene una ruta en curso', 409)
  const { latitud, longitud } = coordenadas(gps)
  return JornadaMensajero.create({ tramitadorId, fecha: hoyBogota(), inicio: new Date(), latitudInicio: latitud, longitudInicio: longitud })
}

export const finalizarJornada = async (tramitadorId: number, gps: Gps) => {
  const jornada = await jornadaAbierta(tramitadorId)
  if (!jornada) throw new ErrorUbicacion('No tiene una ruta en curso', 409)
  const enCurso = await diligenciaEnCurso(tramitadorId)
  if (enCurso) throw new ErrorUbicacion(`Finalice primero la diligencia del trámite #${enCurso.solicitudTramiteId}`, 409)

  const fin = new Date()
  const { latitud, longitud } = coordenadas(gps)
  await db.transaction(async transaction => {
    // Si estaba almorzando, el almuerzo termina con la ruta
    await PausaJornada.update({ fin }, { where: { jornadaId: jornada.id, fin: null }, transaction })
    await jornada.update({
      fin,
      latitudFin: latitud,
      longitudFin: longitud,
      kmGps: String(await kmDeJornada(tramitadorId, jornada.inicio, fin))
    }, { transaction })
  })
  return jornada
}

export const iniciarAlmuerzo = async (tramitadorId: number) => {
  const jornada = await jornadaAbierta(tramitadorId)
  if (!jornada) throw new ErrorUbicacion('Inicie la ruta primero', 409)
  if (pausaAbierta(jornada)) throw new ErrorUbicacion('Ya está en almuerzo', 409)
  const enCurso = await diligenciaEnCurso(tramitadorId)
  if (enCurso) throw new ErrorUbicacion(`Finalice primero la diligencia del trámite #${enCurso.solicitudTramiteId}`, 409)
  return PausaJornada.create({ jornadaId: jornada.id, tipo: 'ALMUERZO', inicio: new Date() })
}

export const terminarAlmuerzo = async (tramitadorId: number) => {
  const pausa = pausaAbierta(await jornadaAbierta(tramitadorId))
  if (!pausa) throw new ErrorUbicacion('No está en almuerzo', 409)
  return pausa.update({ fin: new Date() })
}

export const iniciarDiligencia = async (tramitadorId: number, paradaId: number, gps: Gps) => {
  const parada = await ParadaMensajeria.findByPk(paradaId)
  if (!parada || parada.tramitadorId !== tramitadorId) throw new ErrorUbicacion('La parada no existe', 404)
  if (parada.fecha !== hoyBogota()) throw new ErrorUbicacion('Solo se inician diligencias de hoy')
  if (parada.estado !== ESTADOS_PARADA.PENDIENTE) throw new ErrorUbicacion('Esta diligencia ya se finalizó', 409)
  if (parada.inicioDiligencia) throw new ErrorUbicacion('Esta diligencia ya está iniciada', 409)

  const jornada = await jornadaAbierta(tramitadorId)
  if (!jornada) throw new ErrorUbicacion('Inicie la ruta para empezar las diligencias', 409)
  if (pausaAbierta(jornada)) throw new ErrorUbicacion('Está en almuerzo: márquelo como terminado primero', 409)
  const enCurso = await diligenciaEnCurso(tramitadorId)
  if (enCurso) throw new ErrorUbicacion(`Ya tiene en curso la diligencia del trámite #${enCurso.solicitudTramiteId}`, 409)

  const { latitud, longitud } = coordenadas(gps)
  return parada.update({ inicioDiligencia: new Date(), latitudInicio: latitud, longitudInicio: longitud, jornadaId: jornada.id })
}

// ── Resumen de las rutas de un día ─────────

const minutosEntre = (desde: Date, hasta: Date) => Math.max(0, Math.round((hasta.getTime() - desde.getTime()) / 60_000))

export type ResumenJornada = {
  id: number
  tramitadorId: number
  fecha: string
  inicio: string
  fin: string | null
  minutosTotales: number
  minutosAlmuerzo: number
  minutosEfectivos: number
  enAlmuerzo: boolean
  km: number
}

// Rutas de los mensajeros en una fecha (o un rango), con tiempos y km. En una ruta abierta, el
// tiempo y los km van hasta ahora.
export const resumenJornadas = async (filtro: { tramitadorIds?: number[], desde: string, hasta: string }): Promise<ResumenJornada[]> => {
  const jornadas = await JornadaMensajero.findAll({
    where: {
      fecha: { [Op.between]: [filtro.desde, filtro.hasta] },
      ...(filtro.tramitadorIds ? { tramitadorId: filtro.tramitadorIds } : {})
    },
    include: [PausaJornada],
    order: [['fecha', 'ASC'], ['tramitadorId', 'ASC'], ['inicio', 'ASC']]
  })
  const ahora = new Date()
  return Promise.all(jornadas.map(async j => {
    const fin = j.fin ?? ahora
    const minutosTotales = minutosEntre(j.inicio, fin)
    const minutosAlmuerzo = (j.pausas ?? []).reduce((s, p) => s + minutosEntre(p.inicio, p.fin ?? ahora), 0)
    return {
      id: j.id,
      tramitadorId: j.tramitadorId,
      fecha: j.fecha,
      inicio: j.inicio.toISOString(),
      fin: j.fin?.toISOString() ?? null,
      minutosTotales,
      minutosAlmuerzo,
      minutosEfectivos: Math.max(0, minutosTotales - minutosAlmuerzo),
      enAlmuerzo: (j.pausas ?? []).some(p => !p.fin),
      km: j.kmGps !== null ? Number(j.kmGps) : await kmDeJornada(j.tramitadorId, j.inicio, ahora)
    }
  }))
}
