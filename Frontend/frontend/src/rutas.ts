// Rutas de mensajeros: tipos de GET /mensajeria/rutas y utilidades compartidas

export type Sede = {
  id: number
  nombre: string
  direccion: string
  latitud: number | null
  longitud: number | null
  activo?: boolean
}

export type Parada = {
  id: number
  orden: number
  estado: "PENDIENTE" | "ENTREGADO" | "NO_SE_PUDO"
  observacion: string | null
  fechaConfirmacion: string | null
  latitudConfirmacion: number | null
  longitudConfirmacion: number | null
  precisionMetros: number | null
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

export type RutaMensajero = {
  mensajero: { id: number, nombre: string, numero: string | null }
  sede: Sede | null
  paradas: Parada[]
  resumen: { total: number, entregadas: number, noSePudo: number, sinUbicacion: number }
}

export type RutasDelDia = { fecha: string, googleDisponible: boolean, rutas: RutaMensajero[] }

export const NOMBRE_ESTADO_PARADA: Record<Parada["estado"], string> = {
  PENDIENTE: "Pendiente",
  ENTREGADO: "Entregado",
  NO_SE_PUDO: "No se pudo"
}

// Colores de estado de la parada (siempre con número y nombre al lado: nunca solo color)
export const COLOR_ESTADO: Record<Parada["estado"], string> = {
  PENDIENTE: "#0284c7",
  ENTREGADO: "#059669",
  NO_SE_PUDO: "#dc2626"
}

type Punto = { latitud: number | null, longitud: number | null }
const conUbicacion = <T extends Punto>(p: T): p is T & { latitud: number, longitud: number } =>
  p.latitud !== null && p.longitud !== null

const coordenadas = (p: { latitud: number, longitud: number }) => `${p.latitud},${p.longitud}`

// Google Maps admite pocas paradas intermedias por enlace (9 en el celular): la ruta larga se
// parte en tramos que siguen uno detrás de otro.
const PARADAS_POR_TRAMO = 9

// Enlaces para navegar la ruta en la app de Google Maps del celular (no usa la API: no cuesta)
export const enlacesGoogleMaps = (sede: Sede | null, paradas: Punto[]) => {
  const puntos = paradas.filter(conUbicacion)
  if (puntos.length === 0) return []

  const enlaces: string[] = []
  let origen: { latitud: number, longitud: number } | null = sede && conUbicacion(sede) ? sede : null
  for (let i = 0; i < puntos.length; i += PARADAS_POR_TRAMO + 1) {
    const tramo = puntos.slice(i, i + PARADAS_POR_TRAMO + 1)
    const destino = tramo[tramo.length - 1]
    const intermedias = tramo.slice(0, -1)
    const url = new URL("https://www.google.com/maps/dir/")
    url.searchParams.set("api", "1")
    if (origen) url.searchParams.set("origin", coordenadas(origen))
    url.searchParams.set("destination", coordenadas(destino))
    if (intermedias.length) url.searchParams.set("waypoints", intermedias.map(coordenadas).join("|"))
    url.searchParams.set("travelmode", "driving")
    enlaces.push(url.toString())
    origen = destino
  }
  return enlaces
}

// Navegar a una sola parada
export const enlaceParada = (p: Punto & { direccion?: string | null, municipio?: string | null }) => {
  const destino = conUbicacion(p) ? coordenadas(p) : [p.direccion, p.municipio, "Colombia"].filter(Boolean).join(", ")
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`
}

// Distancia en metros (para ver qué tan lejos de la dirección se confirmó la visita)
export const distanciaMetros = (a: { latitud: number, longitud: number }, b: { latitud: number, longitud: number }) => {
  const rad = (g: number) => (g * Math.PI) / 180
  const h = Math.sin(rad(b.latitud - a.latitud) / 2) ** 2
    + Math.cos(rad(a.latitud)) * Math.cos(rad(b.latitud)) * Math.sin(rad(b.longitud - a.longitud) / 2) ** 2
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(h)))
}

// ── Mapa con varias rutas ──

// Un color por mensajero (distintos de los colores de estado, que van en el borde del marcador)
const COLORES_MENSAJERO = ["#2563eb", "#d97706", "#7c3aed", "#db2777", "#0d9488", "#ea580c", "#4f46e5", "#65a30d"]
export const colorMensajero = (indice: number) => COLORES_MENSAJERO[indice % COLORES_MENSAJERO.length]

export type PuntoMapa = [number, number] // [latitud, longitud]

// Ruta lista para dibujar: `trazado` es la línea por las calles (Google); si no hay, se unen
// las paradas con líneas rectas punteadas
export type RutaEnMapa = {
  id: number
  nombre: string
  color: string
  sede: Sede | null
  paradas: Parada[]
  trazado: PuntoMapa[] | null
}

// Puntos de la ruta en orden: sede → paradas con ubicación → sede
export const puntosRuta = (sede: Sede | null, paradas: Parada[]): PuntoMapa[] => {
  const inicio: PuntoMapa[] = sede && conUbicacion(sede) ? [[sede.latitud, sede.longitud]] : []
  return [...inicio, ...paradas.filter(conUbicacion).map(p => [p.latitud, p.longitud] as PuntoMapa), ...inicio]
}

// Decodifica la línea que manda Google ("encoded polyline", precisión 5)
export const decodificarPolyline = (codigo: string): PuntoMapa[] => {
  const puntos: PuntoMapa[] = []
  let indice = 0, latitud = 0, longitud = 0
  const siguiente = () => {
    let resultado = 0, desplazamiento = 0, byte
    do {
      byte = codigo.charCodeAt(indice++) - 63
      resultado |= (byte & 0x1f) << desplazamiento
      desplazamiento += 5
    } while (byte >= 0x20)
    return resultado & 1 ? ~(resultado >> 1) : resultado >> 1
  }
  while (indice < codigo.length) {
    latitud += siguiente()
    longitud += siguiente()
    puntos.push([latitud / 1e5, longitud / 1e5])
  }
  return puntos
}
