import { QueryTypes } from 'sequelize'
import { db } from '../../config/db'
import { ErrorUbicacion, googleDisponible } from './ubicacion'

// =====================================
// AUTOCOMPLETAR DIRECCIONES (Google Places API New + Geocoding)
// Al crear o editar un trámite: el usuario escribe un lugar o una dirección ("Alcaldía de
// Medellín") y elige una sugerencia, o pega un enlace de Google Maps. Se devuelve la
// dirección, las coordenadas y el municipio de Nodex que corresponde.
// =====================================

export type LugarElegido = {
  direccion: string
  nombre: string | null
  latitud: number
  longitud: number
  municipio: { id: number, nombreMunicipio: string, departamento: string } | null
}

type Componente = { longText?: string, long_name?: string, types: string[] }

const clave = () => {
  if (!googleDisponible()) throw new ErrorUbicacion('El autocompletado de direcciones no está configurado', 503)
  return process.env.GOOGLE_MAPS_API_KEY!
}

// "Bogotá, D.C." → "BOGOTA DC" (sin tildes ni signos, para comparar nombres)
const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

// Municipios de Nodex (una copia por municipio: la de menor id), en memoria 1 hora
let municipiosCache: { datos: { id: number, nombreMunicipio: string, departamento: string, n: string, d: string }[], leido: number } | null = null
const municipiosNodex = async () => {
  if (municipiosCache && Date.now() - municipiosCache.leido < 60 * 60 * 1000) return municipiosCache.datos
  const filas = await db.query<{ id: number, nombreMunicipio: string, departamento: string }>(`
    SELECT DISTINCT ON (UPPER(TRIM("nombreMunicipio")), UPPER(TRIM(departamento))) id, "nombreMunicipio", departamento
    FROM "Municipios" ORDER BY UPPER(TRIM("nombreMunicipio")), UPPER(TRIM(departamento)), id
  `, { type: QueryTypes.SELECT })
  const datos = filas.map(m => ({ ...m, n: normalizar(m.nombreMunicipio), d: normalizar(m.departamento ?? '') }))
  municipiosCache = { datos, leido: Date.now() }
  return datos
}

// Municipio de Nodex a partir de lo que dice Google (municipio y departamento)
export const buscarMunicipio = async (componentes: Componente[]) => {
  const texto = (tipo: string) => {
    const c = componentes.find(x => x.types.includes(tipo))
    return c ? normalizar(c.longText ?? c.long_name ?? '') : ''
  }
  const municipio = texto('locality') || texto('administrative_area_level_2')
  const departamento = texto('administrative_area_level_1')
  if (!municipio) return null

  const lista = await municipiosNodex()
  const mismoDepto = (d: string) => !departamento || d === departamento || d.startsWith(departamento) || departamento.startsWith(d)
  const encontrado =
    lista.find(m => m.n === municipio && mismoDepto(m.d)) ??
    // "BOGOTA" vs "BOGOTA D C"
    lista.find(m => (m.n.startsWith(`${municipio} `) || municipio.startsWith(`${m.n} `)) && mismoDepto(m.d)) ??
    lista.find(m => m.n === municipio)
  return encontrado ? { id: encontrado.id, nombreMunicipio: encontrado.nombreMunicipio, departamento: encontrado.departamento } : null
}

// "Cl. 44 #52-165, La Candelaria, Medellín, Antioquia, Colombia" → sin ", Colombia"
const limpiarDireccion = (direccion: string) => direccion.replace(/,\s*Colombia$/i, '').trim()

// ── Sugerencias mientras escribe ──
export const sugerirLugares = async (texto: string, sesion?: string) => {
  const respuesta = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': clave() },
    body: JSON.stringify({
      input: texto,
      includedRegionCodes: ['co'],
      languageCode: 'es',
      ...(sesion ? { sessionToken: sesion } : {})
    }),
    signal: AbortSignal.timeout(8000)
  })
  const json = await respuesta.json() as {
    suggestions?: { placePrediction?: { placeId: string, text?: { text: string }, structuredFormat?: { mainText?: { text: string }, secondaryText?: { text: string } } } }[]
    error?: { message: string }
  }
  if (!respuesta.ok) throw new ErrorUbicacion(`Google no respondió las sugerencias (${json.error?.message ?? respuesta.status})`, 502)

  return (json.suggestions ?? [])
    .map(s => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
    .map(p => ({
      placeId: p.placeId,
      principal: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
      secundario: p.structuredFormat?.secondaryText?.text ?? ''
    }))
}

// ── Lugar elegido: dirección, coordenadas y municipio ──
export const detalleLugar = async (placeId: string, sesion?: string): Promise<LugarElegido> => {
  if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) throw new ErrorUbicacion('Lugar no válido')
  const url = new URL(`https://places.googleapis.com/v1/places/${placeId}`)
  url.searchParams.set('languageCode', 'es')
  if (sesion) url.searchParams.set('sessionToken', sesion)

  const respuesta = await fetch(url, {
    headers: { 'X-Goog-Api-Key': clave(), 'X-Goog-FieldMask': 'displayName,formattedAddress,location,addressComponents' },
    signal: AbortSignal.timeout(8000)
  })
  const json = await respuesta.json() as {
    displayName?: { text: string }
    formattedAddress?: string
    location?: { latitude: number, longitude: number }
    addressComponents?: Componente[]
    error?: { message: string }
  }
  if (!respuesta.ok || !json.location) throw new ErrorUbicacion(`Google no devolvió el lugar (${json.error?.message ?? respuesta.status})`, 502)

  return {
    direccion: limpiarDireccion(json.formattedAddress ?? ''),
    nombre: json.displayName?.text ?? null,
    latitud: json.location.latitude,
    longitud: json.location.longitude,
    municipio: await buscarMunicipio(json.addressComponents ?? [])
  }
}

// ── Enlace pegado de Google Maps ──

// Solo se siguen enlaces de Google (evita que el servidor visite sitios arbitrarios)
const HOSTS_PERMITIDOS = /^(maps\.app\.goo\.gl|goo\.gl|(www\.)?google\.[a-z.]+|maps\.google\.[a-z.]+)$/i

export const coordenadasDeUrl = (url: string) => {
  const decodificada = decodeURIComponent(url)
  // !3d<lat>!4d<lng> es la ubicación del lugar; @lat,lng es el centro de la vista
  const patrones = [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /@(-?\d+\.\d+),(-?\d+\.\d+)/]
  for (const patron of patrones) {
    const m = decodificada.match(patron)
    if (m) return { latitud: Number(m[1]), longitud: Number(m[2]) }
  }
  return null
}

export const lugarDesdeEnlace = async (enlace: string): Promise<LugarElegido> => {
  let url: URL
  try {
    url = new URL(enlace.trim())
  } catch {
    throw new ErrorUbicacion('El enlace no es válido')
  }
  if (!['http:', 'https:'].includes(url.protocol) || !HOSTS_PERMITIDOS.test(url.hostname)) {
    throw new ErrorUbicacion('Pegue un enlace de Google Maps')
  }

  // Los enlaces cortos (maps.app.goo.gl) redirigen a la URL completa con las coordenadas
  let final = url.toString()
  if (!coordenadasDeUrl(final)) {
    const respuesta = await fetch(final, { redirect: 'follow', signal: AbortSignal.timeout(8000) })
    if (!HOSTS_PERMITIDOS.test(new URL(respuesta.url).hostname)) throw new ErrorUbicacion('El enlace no lleva a Google Maps')
    final = respuesta.url
  }

  const punto = coordenadasDeUrl(final)
  if (!punto) throw new ErrorUbicacion('No se encontró la ubicación en el enlace. Abra el lugar en Google Maps y use "Compartir"', 422)
  const nombreLugar = decodeURIComponent(final.match(/\/place\/([^/]+)/)?.[1] ?? '').replace(/\+/g, ' ') || null

  // Dirección a partir de las coordenadas
  const geo = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  geo.searchParams.set('latlng', `${punto.latitud},${punto.longitud}`)
  geo.searchParams.set('language', 'es')
  geo.searchParams.set('key', clave())
  const json = await (await fetch(geo, { signal: AbortSignal.timeout(8000) })).json() as {
    status: string
    results: { formatted_address: string, address_components: Componente[] }[]
  }
  const resultado = json.results?.[0]

  return {
    direccion: resultado ? limpiarDireccion(resultado.formatted_address) : `${punto.latitud}, ${punto.longitud}`,
    nombre: nombreLugar,
    ...punto,
    municipio: resultado ? await buscarMunicipio(resultado.address_components) : null
  }
}
