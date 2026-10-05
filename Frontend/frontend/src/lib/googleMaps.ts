// Carga la API de Google Maps en el navegador una sola vez.
// Usa NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: una clave para el navegador, restringida por dominio
// (la del backend se restringe por IP y no sirve aquí). Si no está, el mapa usa OpenStreetMap.

export const claveMapaGoogle = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

// Los marcadores avanzados piden un Map ID; "DEMO_MAP_ID" sirve mientras se crea uno propio
export const mapIdGoogle = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID"

let carga: Promise<typeof google.maps> | null = null

export const cargarGoogleMaps = () => {
  if (typeof window === "undefined") return Promise.reject(new Error("Solo en el navegador"))
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps)
  if (carga) return carga

  carga = new Promise((resolver, rechazar) => {
    const llamada = `__nodexMapas${Date.now()}`
    ;(window as unknown as Record<string, unknown>)[llamada] = () => resolver(window.google.maps)
    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({
      key: claveMapaGoogle,
      v: "weekly",
      loading: "async",
      libraries: "marker",
      language: "es",
      region: "CO",
      callback: llamada
    })}`
    script.async = true
    script.onerror = () => {
      carga = null
      rechazar(new Error("No se pudo cargar Google Maps"))
    }
    document.head.appendChild(script)
  })
  return carga
}
