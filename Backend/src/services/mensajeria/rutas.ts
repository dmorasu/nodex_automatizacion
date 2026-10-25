import { Op, QueryTypes } from 'sequelize'
import { db } from '../../config/db'
import Tramitador from '../../models/tramitador'
import SedeMensajeria from '../../models/mensajeria/sedeMensajeria'
import ParadaMensajeria, { ESTADOS_PARADA } from '../../models/mensajeria/paradaMensajeria'
import { subirArchivo } from '../azureFileStorage'
import { ErrorUbicacion, googleDisponible } from './ubicacion'
import { jornadaAbierta, resumenJornadas } from './jornadas'

// =====================================
// RUTAS DE MENSAJEROS
// La ruta de un día = los trámites abiertos del mensajero cuya fecha de diligencia es ese
// día. Las paradas se sincronizan solas cada vez que se consulta la ruta: aparecen los
// trámites nuevos y salen los que cambiaron de fecha o de mensajero (si aún no se visitaron).
// =====================================

const ESTADOS_CERRADOS = ['Finalizado', 'Desistido']
const MAXIMO_PARADAS_GOOGLE = 25 // límite de puntos intermedios de Google Routes

export const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

type Candidato = { id: number, tramitadorId: number }

// Trámites abiertos de estos mensajeros programados para la fecha
const candidatosDelDia = (fecha: string, tramitadorIds: number[]) =>
  db.query<Candidato>(`
    SELECT s.id, s."tramitadorId"
    FROM "SolicitudTramites" s
    JOIN "Programacion" p ON p."solicitudTramiteId" = s.id
    LEFT JOIN "Estados" e ON e.id = s."estadoActualTramite"
    WHERE s."tramitadorId" IN (:tramitadorIds)
      -- La fecha de diligencia se guarda como medianoche UTC del día programado
      AND (p."fechaProbableEntrega" AT TIME ZONE 'UTC')::date = CAST(:fecha AS DATE)
      AND COALESCE(e."nombreEstado" NOT IN (:cerrados), true)
  `, { type: QueryTypes.SELECT, replacements: { fecha, tramitadorIds, cerrados: ESTADOS_CERRADOS } })

// Crea, mueve o quita paradas para que coincidan con lo programado.
// Las paradas ya visitadas (Realizado / No realizado) nunca se tocan.
const sincronizarParadas = async (fecha: string, tramitadorIds: number[]) => {
  if (tramitadorIds.length === 0) return

  await db.transaction(async transaction => {
    const candidatos = await candidatosDelDia(fecha, tramitadorIds)
    const candidatoPorTramite = new Map(candidatos.map(c => [c.id, c]))
    const existentes = await ParadaMensajeria.findAll({
      where: {
        fecha,
        [Op.or]: [{ tramitadorId: tramitadorIds }, { solicitudTramiteId: candidatos.map(c => c.id) }]
      },
      transaction,
      lock: transaction.LOCK.UPDATE
    })

    const ultimoOrden = new Map<number, number>()
    for (const p of existentes) ultimoOrden.set(p.tramitadorId, Math.max(ultimoOrden.get(p.tramitadorId) ?? 0, p.orden))
    const siguienteOrden = (tramitadorId: number) => {
      const orden = (ultimoOrden.get(tramitadorId) ?? 0) + 1
      ultimoOrden.set(tramitadorId, orden)
      return orden
    }

    const conParada = new Set<number>()
    for (const parada of existentes) {
      conParada.add(parada.solicitudTramiteId)
      if (parada.estado !== ESTADOS_PARADA.PENDIENTE) continue

      const candidato = candidatoPorTramite.get(parada.solicitudTramiteId)
      if (!candidato) {
        // Cambió de fecha, de mensajero (a uno no mensajero) o se cerró
        await parada.destroy({ transaction })
      } else if (candidato.tramitadorId !== parada.tramitadorId) {
        // Se le asignó a otro mensajero: pasa al final de su ruta
        await parada.update({ tramitadorId: candidato.tramitadorId, orden: siguienteOrden(candidato.tramitadorId) }, { transaction })
      }
    }

    for (const candidato of candidatos) {
      if (conParada.has(candidato.id)) continue
      await ParadaMensajeria.create({
        solicitudTramiteId: candidato.id,
        fecha,
        tramitadorId: candidato.tramitadorId,
        orden: siguienteOrden(candidato.tramitadorId)
      }, { transaction })
    }
  })
}

type FilaParada = {
  id: number
  orden: number
  estado: string
  tramitadorId: number
  observacion: string | null
  fechaConfirmacion: string | null
  latitudConfirmacion: number | null
  longitudConfirmacion: number | null
  precisionMetros: number | null
  inicioDiligencia: string | null
  jornadaId: number | null
  tieneFoto: boolean
  tramiteId: number
  cliente: string | null
  tipo: string | null
  placa: string | null
  detalle: string | null
  direccion: string | null
  municipio: string | null
  latitud: number | null
  longitud: number | null
  ubicacionPrecisa: boolean | null
  ubicacionFuente: string | null
  estadoTramite: string
}

const consultarParadas = async (fecha: string, tramitadorIds: number[]) => {
  if (tramitadorIds.length === 0) return []
  const filas = await db.query<FilaParada>(`
    SELECT
      pa.id, pa.orden, pa.estado, pa.tramitador_id AS "tramitadorId", pa.observacion,
      pa.fecha_confirmacion AS "fechaConfirmacion",
      pa.latitud_confirmacion AS "latitudConfirmacion", pa.longitud_confirmacion AS "longitudConfirmacion",
      pa.precision_metros AS "precisionMetros", (pa.foto_nombre IS NOT NULL) AS "tieneFoto",
      pa.inicio_diligencia AS "inicioDiligencia", pa.jornada_id AS "jornadaId",
      s.id AS "tramiteId", c."nombreCliente" AS cliente, tr."nombreTramite" AS tipo,
      COALESCE(s.placa, s."matriculaInmobiliaria") AS placa, s."detalleSolicitud" AS detalle,
      s."direccionTramite" AS direccion, m."nombreMunicipio" AS municipio,
      s.latitud, s.longitud, s."ubicacionPrecisa", s."ubicacionFuente",
      COALESCE(e."nombreEstado", 'Sin Iniciar') AS "estadoTramite"
    FROM mensajeria_paradas pa
    JOIN "SolicitudTramites" s ON s.id = pa.solicitud_tramite_id
    LEFT JOIN "Clientes" c ON c.id = s."clienteId"
    LEFT JOIN "Tramites" tr ON tr.id = s."tramiteId"
    LEFT JOIN "Municipios" m ON m.id = s."municipiosId"
    LEFT JOIN "Estados" e ON e.id = s."estadoActualTramite"
    WHERE pa.fecha = CAST(:fecha AS DATE) AND pa.tramitador_id IN (:tramitadorIds)
    ORDER BY pa.orden, pa.id
  `, { type: QueryTypes.SELECT, replacements: { fecha, tramitadorIds } })

  return filas.map(f => ({
    ...f,
    latitud: f.latitud === null ? null : Number(f.latitud),
    longitud: f.longitud === null ? null : Number(f.longitud)
  }))
}

const datosSede = (sede: SedeMensajeria | null | undefined) => sede
  ? { id: sede.id, nombre: sede.nombre, direccion: sede.direccion, latitud: sede.latitud, longitud: sede.longitud }
  : null

// Rutas del día de todos los mensajeros activos (opcionalmente de una sede)
export const rutasDelDia = async (fecha: string, sedeId?: number) => {
  const mensajeros = await Tramitador.findAll({
    where: { esMensajero: true, activo: true, ...(sedeId ? { sedeId } : {}) },
    attributes: ['id', 'nombreTramitador', 'numeroTramitador', 'sedeId'],
    include: [{ model: SedeMensajeria }],
    order: [['nombreTramitador', 'ASC']]
  })
  const ids = mensajeros.map(m => m.id)

  await sincronizarParadas(fecha, ids)
  const [paradas, jornadas] = await Promise.all([
    consultarParadas(fecha, ids),
    ids.length ? resumenJornadas({ tramitadorIds: ids, desde: fecha, hasta: fecha }) : Promise.resolve([])
  ])

  return {
    fecha,
    googleDisponible: googleDisponible(),
    rutas: mensajeros.map(m => {
      const suyas = paradas.filter(p => p.tramitadorId === m.id)
      return {
        mensajero: { id: m.id, nombre: m.nombreTramitador.trim(), numero: m.numeroTramitador },
        sede: datosSede(m.sede),
        paradas: suyas,
        // Rutas marcadas en la app ese día (inicio, fin, almuerzo, km por GPS)
        jornadas: jornadas.filter(j => j.tramitadorId === m.id),
        resumen: {
          total: suyas.length,
          entregadas: suyas.filter(p => p.estado === ESTADOS_PARADA.ENTREGADO).length,
          noSePudo: suyas.filter(p => p.estado === ESTADOS_PARADA.NO_SE_PUDO).length,
          sinUbicacion: suyas.filter(p => p.latitud === null).length
        }
      }
    })
  }
}

// Ruta de un mensajero (app Nodex Tramitadores)
export const rutaDelMensajero = async (tramitadorId: number, fecha: string) => {
  const mensajero = await Tramitador.findByPk(tramitadorId, { include: [{ model: SedeMensajeria }] })
  if (!mensajero?.esMensajero) throw new ErrorUbicacion('No está registrado como mensajero', 403)

  await sincronizarParadas(fecha, [tramitadorId])
  const [paradas, jornadas, abierta] = await Promise.all([
    consultarParadas(fecha, [tramitadorId]),
    resumenJornadas({ tramitadorIds: [tramitadorId], desde: fecha, hasta: fecha }),
    jornadaAbierta(tramitadorId)
  ])
  // La ruta en curso puede venir de otro día (si no la finalizó): se muestra para que la cierre
  return {
    fecha,
    sede: datosSede(mensajero.sede),
    paradas,
    jornadas,
    jornadaAbierta: abierta ? { id: abierta.id, fecha: abierta.fecha, inicio: abierta.inicio.toISOString(), enAlmuerzo: (abierta.pausas ?? []).some(p => !p.fin) } : null
  }
}

// Orden manual (el analista arrastra o sube/baja paradas)
export const reordenarParadas = async (fecha: string, tramitadorId: number, paradaIds: number[]) =>
  db.transaction(async transaction => {
    const paradas = await ParadaMensajeria.findAll({ where: { fecha, tramitadorId }, transaction, lock: transaction.LOCK.UPDATE })
    const actuales = new Set(paradas.map(p => p.id))
    if (paradaIds.length !== actuales.size || !paradaIds.every(id => actuales.has(id))) {
      throw new ErrorUbicacion('La ruta cambió mientras la editaba. Recargue la página e intente de nuevo', 409)
    }
    for (const [i, id] of paradaIds.entries()) {
      await ParadaMensajeria.update({ orden: i + 1 }, { where: { id }, transaction })
    }
  })

// ── Optimización ─────────────────────────

type Punto = { latitud: number, longitud: number }

// Distancia en línea recta (km)
const distanciaKm = (a: Punto, b: Punto) => {
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b.latitud - a.latitud)
  const dLon = rad(b.longitud - a.longitud)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitud)) * Math.cos(rad(b.latitud)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

// Sin Google: siempre al punto más cercano (buena aproximación para pocas paradas en una ciudad)
const vecinoMasCercano = <T extends Punto>(origen: Punto, puntos: T[]) => {
  const pendientes = [...puntos]
  const orden: T[] = []
  let actual = origen
  let km = 0
  while (pendientes.length) {
    let mejor = 0
    for (let i = 1; i < pendientes.length; i++) {
      if (distanciaKm(actual, pendientes[i]) < distanciaKm(actual, pendientes[mejor])) mejor = i
    }
    const [siguiente] = pendientes.splice(mejor, 1)
    km += distanciaKm(actual, siguiente)
    orden.push(siguiente)
    actual = siguiente
  }
  km += distanciaKm(actual, origen) // regreso a la sede
  return { orden, km }
}

// Con Google Routes: orden óptimo real por calles, saliendo y volviendo a la sede
const optimizarConGoogle = async <T extends Punto>(sede: Punto, puntos: T[]) => {
  const punto = (p: Punto) => ({ location: { latLng: { latitude: p.latitud, longitude: p.longitud } } })
  const respuesta = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY!,
      'X-Goog-FieldMask': 'routes.optimizedIntermediateWaypointIndex,routes.distanceMeters,routes.duration'
    },
    body: JSON.stringify({
      origin: punto(sede),
      destination: punto(sede),
      intermediates: puntos.map(punto),
      travelMode: 'DRIVE',
      optimizeWaypointOrder: true,
      languageCode: 'es-CO'
    }),
    signal: AbortSignal.timeout(15000)
  })
  const json = await respuesta.json() as {
    routes?: { optimizedIntermediateWaypointIndex?: number[], distanceMeters?: number, duration?: string }[]
    error?: { message: string }
  }
  const ruta = json.routes?.[0]
  if (!respuesta.ok || !ruta) throw new Error(json.error?.message ?? `Google Routes respondió ${respuesta.status}`)

  const indices = ruta.optimizedIntermediateWaypointIndex ?? puntos.map((_, i) => i)
  return {
    orden: indices.map(i => puntos[i]),
    km: Math.round((ruta.distanceMeters ?? 0) / 100) / 10,
    minutos: ruta.duration ? Math.round(Number(ruta.duration.replace('s', '')) / 60) : null
  }
}

// Optimiza el orden de las paradas pendientes con ubicación. Las ya visitadas quedan primero
// (en su orden) y las que no tienen ubicación, al final.
export const optimizarRuta = async (fecha: string, tramitadorId: number) => {
  const mensajero = await Tramitador.findByPk(tramitadorId, { include: [{ model: SedeMensajeria }] })
  if (!mensajero?.esMensajero) throw new ErrorUbicacion('El tramitador no es mensajero', 404)
  const sede = mensajero.sede
  if (!sede || sede.latitud === null || sede.longitud === null) {
    throw new ErrorUbicacion('El mensajero no tiene sede con ubicación: asígnele una sede y ubíquela en el mapa')
  }

  const paradas = await consultarParadas(fecha, [tramitadorId])
  const visitadas = paradas.filter(p => p.estado !== ESTADOS_PARADA.PENDIENTE)
  const pendientes = paradas.filter(p => p.estado === ESTADOS_PARADA.PENDIENTE)
  const ubicadas = pendientes
    .filter(p => p.latitud !== null && p.longitud !== null)
    .map(p => ({ ...p, latitud: p.latitud!, longitud: p.longitud! }))
  const sinUbicar = pendientes.filter(p => p.latitud === null || p.longitud === null)
  if (ubicadas.length < 2) throw new ErrorUbicacion('Se necesitan al menos 2 paradas pendientes con ubicación para optimizar')

  const origen = { latitud: sede.latitud, longitud: sede.longitud }
  let resultado: { orden: typeof ubicadas, km: number, minutos?: number | null }
  let metodo: 'GOOGLE' | 'APROXIMADO' = 'APROXIMADO'

  if (googleDisponible() && ubicadas.length <= MAXIMO_PARADAS_GOOGLE) {
    try {
      resultado = await optimizarConGoogle(origen, ubicadas)
      metodo = 'GOOGLE'
    } catch (error) {
      console.warn('⚠️ Google Routes falló; se usa el orden aproximado:', (error as Error).message)
      resultado = vecinoMasCercano(origen, ubicadas)
    }
  } else {
    resultado = vecinoMasCercano(origen, ubicadas)
  }

  await reordenarParadas(fecha, tramitadorId, [...visitadas, ...resultado.orden, ...sinUbicar].map(p => p.id))

  return {
    metodo,
    kilometros: Math.round(resultado.km * 10) / 10,
    minutos: resultado.minutos ?? null,
    sinUbicacion: sinUbicar.length
  }
}

// ── Confirmación de la visita (app) ──────

const TIPOS_FOTO = ['image/jpeg', 'image/png']

export const confirmarParada = async (
  tramitadorId: number,
  paradaId: number,
  datos: { estado: string, observacion?: string | null, latitud?: number | null, longitud?: number | null, precision?: number | null },
  foto?: Express.Multer.File
) => {
  const parada = await ParadaMensajeria.findByPk(paradaId)
  if (!parada || parada.tramitadorId !== tramitadorId) throw new ErrorUbicacion('La parada no existe', 404)
  if (parada.fecha > hoyBogota()) throw new ErrorUbicacion('Solo puede confirmar visitas de hoy o de días anteriores')

  if (![ESTADOS_PARADA.ENTREGADO, ESTADOS_PARADA.NO_SE_PUDO].includes(datos.estado as any)) throw new ErrorUbicacion('Estado no válido')
  const observacion = datos.observacion?.trim() || null
  if (datos.estado === ESTADOS_PARADA.NO_SE_PUDO && !observacion) throw new ErrorUbicacion('Cuente por qué no se realizó la diligencia')
  // Hoy, la confirmación es el fin de la diligencia: debe estar iniciada (para medir su tiempo).
  // Las de días anteriores se pueden confirmar como antes.
  if (parada.fecha === hoyBogota() && parada.estado === ESTADOS_PARADA.PENDIENTE && !parada.inicioDiligencia) {
    throw new ErrorUbicacion('Primero toque "Iniciar diligencia" al llegar al sitio', 409)
  }
  if (foto && !TIPOS_FOTO.includes(foto.mimetype)) throw new ErrorUbicacion('La foto debe ser JPG o PNG')

  let fotoDatos = {}
  if (foto) {
    const extension = foto.mimetype === 'image/png' ? 'png' : 'jpg'
    const fotoRuta = `mensajeria/${parada.fecha}/${parada.solicitudTramiteId}`
    const fotoNombre = `visita-${parada.id}-${Date.now()}.${extension}`
    await subirArchivo(fotoRuta, fotoNombre, foto.buffer)
    fotoDatos = { fotoRuta, fotoNombre, fotoTipo: foto.mimetype }
  }

  const numero = (v: unknown) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v))
  await parada.update({
    estado: datos.estado,
    observacion,
    fechaConfirmacion: new Date(),
    latitudConfirmacion: numero(datos.latitud),
    longitudConfirmacion: numero(datos.longitud),
    precisionMetros: numero(datos.precision) === null ? null : Math.round(numero(datos.precision)!),
    ...fotoDatos
  })
  return parada
}
