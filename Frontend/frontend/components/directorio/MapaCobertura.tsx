"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { EVENTO_CLAVE_RECHAZADA, cargarGoogleMaps, claveMapaGoogle, googleRechazoLaClave, mapIdGoogle } from "@/src/lib/googleMaps"

export type Categoria = "tram" | "mens" | "ambos" | "none"
export type PuntoCobertura = { id: number, lat: number, lng: number, categoria: Categoria, personas: number, titulo: string }

export const COLOR_TRAM = "#0b80c3"
export const COLOR_MENS = "#1f9d61"

// Círculo del municipio: azul tramitadores, verde mensajeros, azul con aro verde si hay ambos,
// gris si nadie lo cubre. Crece con el número de personas que lo atienden
const elementoPunto = (p: PuntoCobertura, elegido: boolean) => {
  const span = document.createElement("span")
  const tam = p.categoria === "none" ? 8 : Math.min(26, 11 + p.personas * 2.5)
  const fondo = p.categoria === "mens" ? COLOR_MENS : p.categoria === "none" ? "#cbd5e1" : COLOR_TRAM
  const aro = p.categoria === "ambos" ? `3px solid ${COLOR_MENS}` : `2px solid #fff`
  span.style.cssText = `display:block;width:${tam}px;height:${tam}px;border-radius:9999px;background:${fondo};border:${aro};`
    + `box-shadow:${elegido ? "0 0 0 3px #0f172a," : ""}0 1px 3px rgba(15,23,42,.35);cursor:pointer;opacity:${p.categoria === "none" ? 0.85 : 0.95};transform:translateY(50%)`
  return span
}

const elementoCasa = () => {
  const span = document.createElement("span")
  span.textContent = "⌂"
  span.style.cssText = "display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:#0f172a;color:#fff;font:700 15px system-ui;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"
  return span
}

// Mapa de Google con la cobertura. `encuadre` cambia cuando hay que reencuadrar (filtro o foco)
export default function MapaCobertura({ puntos, encuadre, elegido, casa, onMunicipio }: {
  puntos: PuntoCobertura[]
  encuadre: { clave: string, puntos: { lat: number, lng: number }[] }
  elegido: number | null
  casa: { lat: number, lng: number, titulo: string } | null
  onMunicipio: (id: number) => void
}) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<google.maps.Map | null>(null)
  const marcadores = useRef<google.maps.marker.AdvancedMarkerElement[]>([])
  const alElegir = useRef(onMunicipio)
  const [listo, setListo] = useState(false)
  const [error, setError] = useState<string | null>(claveMapaGoogle ? null : "Falta la clave de Google Maps (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).")

  useEffect(() => { alElegir.current = onMunicipio }, [onMunicipio])

  // Google rechazó la clave (dominio no autorizado): se dice en vez de dejar el mapa en gris
  const [rechazada, setRechazada] = useState(googleRechazoLaClave)
  useEffect(() => {
    const avisar = () => setRechazada(true)
    window.addEventListener(EVENTO_CLAVE_RECHAZADA, avisar)
    return () => window.removeEventListener(EVENTO_CLAVE_RECHAZADA, avisar)
  }, [])

  useEffect(() => {
    if (!claveMapaGoogle) return
    let cancelado = false
    cargarGoogleMaps()
      .then(maps => {
        if (cancelado || !contenedor.current) return
        mapa.current = new maps.Map(contenedor.current, {
          center: { lat: 4.4, lng: -73.6 },
          zoom: 5.4,
          mapId: mapIdGoogle,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          gestureHandling: "cooperative",
          // Colombia y un poco alrededor
          restriction: { latLngBounds: { north: 16.5, south: -6, west: -84, east: -64 }, strictBounds: false }
        })
        setListo(true)
      })
      .catch(e => setError((e as Error).message))
    return () => { cancelado = true }
  }, [])

  const clavePuntos = useMemo(() => JSON.stringify([puntos.map(p => [p.id, p.categoria, p.personas]), elegido, casa]), [puntos, elegido, casa])

  // Dibuja los puntos de nuevo cuando cambian los filtros
  useEffect(() => {
    const m = mapa.current
    if (!listo || !m) return
    marcadores.current.forEach(x => { x.map = null })
    marcadores.current = []
    // Los grises abajo; los cubiertos encima (los de más personas al frente)
    for (const p of [...puntos].sort((a, b) => Number(a.categoria !== "none") - Number(b.categoria !== "none") || a.personas - b.personas)) {
      const marcador = new google.maps.marker.AdvancedMarkerElement({
        map: m, position: { lat: p.lat, lng: p.lng }, content: elementoPunto(p, p.id === elegido), title: p.titulo,
        zIndex: p.id === elegido ? 50 : p.categoria === "none" ? 1 : 2 + p.personas
      })
      marcador.addListener("click", () => alElegir.current(p.id))
      marcadores.current.push(marcador)
    }
    if (casa) {
      marcadores.current.push(new google.maps.marker.AdvancedMarkerElement({ map: m, position: { lat: casa.lat, lng: casa.lng }, content: elementoCasa(), title: casa.titulo, zIndex: 60 }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, clavePuntos])

  // Encuadre (solo cuando cambia el filtro o el foco, no al redibujar)
  useEffect(() => {
    const m = mapa.current
    if (!listo || !m) return
    if (!encuadre.puntos.length) { m.setCenter({ lat: 4.4, lng: -73.6 }); m.setZoom(5.4); return }
    const limites = new google.maps.LatLngBounds()
    encuadre.puntos.forEach(p => limites.extend(p))
    m.fitBounds(limites, 48)
    google.maps.event.addListenerOnce(m, "idle", () => { if ((m.getZoom() ?? 0) > 11) m.setZoom(11) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, encuadre.clave])

  useEffect(() => () => { marcadores.current.forEach(x => { x.map = null }) }, [])

  return (
    <div className="relative h-[520px] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
      <div ref={contenedor} className="h-full w-full" />
      {rechazada && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 p-6 text-center text-xs text-slate-600">
          <p>Google Maps no acepta este sitio con la clave configurada.<br />
            Hay que autorizar <b>{typeof window !== "undefined" ? window.location.origin : ""}</b> en la clave del navegador (Google Cloud → Credenciales).<br />
            El resto de la cobertura (panel y rankings) funciona igual.</p>
        </div>
      )}
      {!listo && !rechazada && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-xs text-slate-500">
          {error ?? <span className="inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Cargando el mapa…</span>}
        </div>
      )}
    </div>
  )
}
