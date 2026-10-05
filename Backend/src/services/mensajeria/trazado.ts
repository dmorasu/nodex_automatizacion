import { ErrorUbicacion, googleDisponible } from './ubicacion'

// =====================================
// TRAZADO DE LA RUTA POR LAS CALLES (Google Routes API, "Compute Routes Essentials")
// Recibe los puntos en el orden de la ruta (sede → paradas → sede) y devuelve la línea
// codificada (encoded polyline) para dibujarla en el mapa, con distancia y tiempo.
// Cada consulta a Google se cobra (10.000 gratis al mes), así que se guarda en memoria:
// la misma ruta (mismos puntos en el mismo orden) no se vuelve a pedir en 12 horas.
// =====================================

type Punto = { latitud: number, longitud: number }
export type Trazado = { polyline: string | null, km: number | null, minutos: number | null }

export const MAXIMO_PUNTOS_TRAZADO = 27 // origen + destino + 25 intermedios (límite de Google)
const VIGENCIA_MS = 12 * 60 * 60 * 1000
const MAXIMO_EN_CACHE = 500

const cache = new Map<string, { trazado: Trazado, hasta: number }>()

// 5 decimales ≈ 1 metro: evita pedir de nuevo por diferencias mínimas
const claveDe = (puntos: Punto[]) => puntos.map(p => `${p.latitud.toFixed(5)},${p.longitud.toFixed(5)}`).join('|')

export const trazarRuta = async (puntos: Punto[]): Promise<Trazado> => {
  if (puntos.length < 2) throw new ErrorUbicacion('Se necesitan al menos 2 puntos para trazar la ruta')
  if (puntos.length > MAXIMO_PUNTOS_TRAZADO) throw new ErrorUbicacion(`Máximo ${MAXIMO_PUNTOS_TRAZADO} puntos por ruta`)
  // Sin Google se devuelve vacío y el mapa dibuja líneas rectas entre las paradas
  if (!googleDisponible()) return { polyline: null, km: null, minutos: null }

  const clave = claveDe(puntos)
  const guardado = cache.get(clave)
  if (guardado && guardado.hasta > Date.now()) return guardado.trazado

  const punto = (p: Punto) => ({ location: { latLng: { latitude: p.latitud, longitude: p.longitud } } })
  const respuesta = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY!,
      // Solo estos campos: mantiene la consulta en la tarifa "Essentials"
      'X-Goog-FieldMask': 'routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration'
    },
    body: JSON.stringify({
      origin: punto(puntos[0]),
      destination: punto(puntos[puntos.length - 1]),
      intermediates: puntos.slice(1, -1).map(punto),
      travelMode: 'DRIVE',
      polylineEncoding: 'ENCODED_POLYLINE',
      languageCode: 'es-CO'
    }),
    signal: AbortSignal.timeout(15000)
  })
  const json = await respuesta.json() as {
    routes?: { polyline?: { encodedPolyline?: string }, distanceMeters?: number, duration?: string }[]
    error?: { message: string }
  }
  const ruta = json.routes?.[0]
  if (!respuesta.ok || !ruta?.polyline?.encodedPolyline) {
    throw new ErrorUbicacion(`Google no pudo trazar la ruta (${json.error?.message ?? respuesta.status})`, 502)
  }

  const trazado: Trazado = {
    polyline: ruta.polyline.encodedPolyline,
    km: ruta.distanceMeters !== undefined ? Math.round(ruta.distanceMeters / 100) / 10 : null,
    minutos: ruta.duration ? Math.round(Number(ruta.duration.replace('s', '')) / 60) : null
  }

  // Si se llena, se descarta lo más antiguo
  if (cache.size >= MAXIMO_EN_CACHE) cache.delete(cache.keys().next().value!)
  cache.set(clave, { trazado, hasta: Date.now() + VIGENCIA_MS })
  return trazado
}
