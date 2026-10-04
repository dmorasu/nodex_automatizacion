// Enlaces de navegación para el mensajero (abren la app de Google Maps del celular: no cuestan)

type Punto = { latitud: number | null, longitud: number | null }
type PuntoUbicado = { latitud: number, longitud: number }

const ubicado = <T extends Punto>(p: T): p is T & PuntoUbicado => p.latitud !== null && p.longitud !== null
const coordenadas = (p: PuntoUbicado) => `${p.latitud},${p.longitud}`

// Google Maps admite 9 paradas intermedias por enlace en el celular: las rutas largas van en tramos
const PARADAS_POR_TRAMO = 9

// Ruta completa (sede → paradas pendientes en orden)
export const enlacesRuta = (sede: Punto | null, paradas: Punto[]) => {
  const puntos = paradas.filter(ubicado)
  const enlaces: string[] = []
  let origen: PuntoUbicado | null = sede && ubicado(sede) ? sede : null

  for (let i = 0; i < puntos.length; i += PARADAS_POR_TRAMO + 1) {
    const tramo = puntos.slice(i, i + PARADAS_POR_TRAMO + 1)
    const destino = tramo[tramo.length - 1]
    const intermedias = tramo.slice(0, -1)
    const url = new URL("https://www.google.com/maps/dir/")
    url.searchParams.set("api", "1")
    // Sin origen, Google Maps arranca desde donde está el celular
    if (origen) url.searchParams.set("origin", coordenadas(origen))
    url.searchParams.set("destination", coordenadas(destino))
    if (intermedias.length) url.searchParams.set("waypoints", intermedias.map(coordenadas).join("|"))
    url.searchParams.set("travelmode", "driving")
    enlaces.push(url.toString())
    origen = destino
  }
  return enlaces
}

// Navegar a una parada (desde donde esté el celular). Sin ubicación, busca por la dirección.
export const enlaceGoogleMaps = (p: Punto & { direccion: string | null, municipio: string | null }) => {
  const destino = ubicado(p) ? coordenadas(p) : [p.direccion, p.municipio, "Colombia"].filter(Boolean).join(", ")
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}&travelmode=driving`
}

export const enlaceWaze = (p: Punto & { direccion: string | null, municipio: string | null }) =>
  ubicado(p)
    ? `https://waze.com/ul?ll=${p.latitud},${p.longitud}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent([p.direccion, p.municipio].filter(Boolean).join(", "))}&navigate=yes`
