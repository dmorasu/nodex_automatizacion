import SolicitudTramites from '../../models/solicitudTramites'
import Municipios from '../../models/municipios'

// =====================================
// UBICACIÓN DE DIRECCIONES (Google Geocoding API)
// La clave va solo en el backend (GOOGLE_MAPS_API_KEY). Sin clave todo funciona en modo
// manual: el analista pone el punto en el mapa.
// =====================================

export class ErrorUbicacion extends Error {
  constructor(mensaje: string, public status = 400) {
    super(mensaje)
  }
}

export const googleDisponible = () => Boolean(process.env.GOOGLE_MAPS_API_KEY)

export type Coordenadas = { latitud: number, longitud: number }

// Resultado exacto (la puerta) o interpolado sobre la calle: sirve para una visita.
// GEOMETRIC_CENTER o APPROXIMATE (barrio, calle, municipio) queda marcado para revisar.
const TIPOS_PRECISOS = ['ROOFTOP', 'RANGE_INTERPOLATED']

// Convierte un texto de dirección en coordenadas. null si Google no la encuentra.
export const geocodificar = async (direccion: string): Promise<(Coordenadas & { precisa: boolean }) | null> => {
  if (!googleDisponible()) throw new ErrorUbicacion('La ubicación automática no está configurada (falta la clave de Google Maps)', 503)

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('address', direccion)
  url.searchParams.set('components', 'country:CO')
  url.searchParams.set('language', 'es')
  url.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY!)

  const respuesta = await fetch(url, { signal: AbortSignal.timeout(10000) })
  const json = await respuesta.json() as {
    status: string
    error_message?: string
    results: { geometry: { location: { lat: number, lng: number }, location_type: string }, partial_match?: boolean }[]
  }

  if (json.status === 'ZERO_RESULTS') return null
  if (json.status !== 'OK') throw new ErrorUbicacion(`Google no pudo ubicar la dirección (${json.status}${json.error_message ? `: ${json.error_message}` : ''})`, 502)

  const resultado = json.results[0]
  return {
    latitud: resultado.geometry.location.lat,
    longitud: resultado.geometry.location.lng,
    precisa: TIPOS_PRECISOS.includes(resultado.geometry.location_type) && !resultado.partial_match
  }
}

// Texto completo que se envía a Google: dirección + municipio + departamento
const textoDireccion = async (solicitud: SolicitudTramites) => {
  if (!solicitud.direccionTramite?.trim()) return null
  const municipio = solicitud.municipiosId
    ? await Municipios.findByPk(solicitud.municipiosId, { attributes: ['nombreMunicipio', 'departamento'] })
    : null
  return [solicitud.direccionTramite.trim(), municipio?.nombreMunicipio, municipio?.departamento, 'Colombia']
    .filter(Boolean)
    .join(', ')
}

// Ubica un trámite con Google. Si la dirección no cambió y ya estaba ubicado, no hace nada
// (salvo `forzar`). Una ubicación MANUAL no se reemplaza a menos que la dirección cambie.
export const ubicarTramite = async (solicitudId: number, { forzar = false } = {}) => {
  const solicitud = await SolicitudTramites.findByPk(solicitudId)
  if (!solicitud) throw new ErrorUbicacion('El trámite no existe', 404)

  const texto = await textoDireccion(solicitud)
  if (!texto) throw new ErrorUbicacion('El trámite no tiene dirección')

  const mismaDireccion = solicitud.ubicacionDireccion === texto && solicitud.latitud !== null
  if (mismaDireccion && !forzar) return { solicitud, cambio: false }

  const resultado = await geocodificar(texto)
  await solicitud.update({
    latitud: resultado?.latitud ?? null,
    longitud: resultado?.longitud ?? null,
    ubicacionFuente: resultado ? 'GOOGLE' : null,
    ubicacionPrecisa: resultado ? resultado.precisa : null,
    ubicacionDireccion: texto
  })
  return { solicitud, cambio: true, encontrada: Boolean(resultado) }
}

// Al crear o editar un trámite: ubica en segundo plano (no demora la respuesta ni la rompe)
export const ubicarEnSegundoPlano = (solicitudId: number) => {
  if (!googleDisponible()) return
  ubicarTramite(solicitudId).catch(error =>
    console.warn(`⚠️ No se pudo ubicar el trámite ${solicitudId}:`, (error as Error).message))
}

// Dirección nueva escrita al corregir la ubicación (mismo límite de la columna, 100)
const direccionValida = (direccion: string) => {
  const limpia = direccion.trim()
  if (!limpia) throw new ErrorUbicacion('La dirección no puede quedar vacía')
  if (limpia.length > 100) throw new ErrorUbicacion('La dirección no puede superar los 100 caracteres')
  return limpia
}

// Punto puesto a mano en el mapa (corrige o reemplaza lo de Google), o el lugar exacto que
// se eligió con el autocompletado al crear o editar el trámite (fuente GOOGLE).
// Con `direccion` también corrige la dirección del trámite (queda en el historial por el hook).
export const ubicarManual = async (
  solicitudId: number,
  { latitud, longitud }: Coordenadas,
  fuente: 'MANUAL' | 'GOOGLE' = 'MANUAL',
  direccion?: string
) => {
  if (!(Math.abs(latitud) <= 90 && Math.abs(longitud) <= 180)) throw new ErrorUbicacion('Coordenadas no válidas')

  const solicitud = await SolicitudTramites.findByPk(solicitudId)
  if (!solicitud) throw new ErrorUbicacion('El trámite no existe', 404)

  if (direccion !== undefined) solicitud.set('direccionTramite', direccionValida(direccion))
  solicitud.set({
    latitud,
    longitud,
    ubicacionFuente: fuente,
    ubicacionPrecisa: true,
    // Se guarda la dirección actual (ya con la nueva): si luego cambia, se vuelve a ubicar
    ubicacionDireccion: await textoDireccion(solicitud)
  })
  await solicitud.save()
  return solicitud
}

// Busca en Google una dirección escrita que aún no se guarda (al corregir en el mapa).
// No guarda nada: el punto se guarda con ubicarManual al confirmar.
export const buscarDireccion = async (solicitudId: number, direccion: string) => {
  const solicitud = await SolicitudTramites.findByPk(solicitudId)
  if (!solicitud) throw new ErrorUbicacion('El trámite no existe', 404)
  solicitud.set('direccionTramite', direccionValida(direccion))
  const texto = await textoDireccion(solicitud)
  return texto ? geocodificar(texto) : null
}
