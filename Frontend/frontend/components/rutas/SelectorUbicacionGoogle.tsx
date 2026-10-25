"use client"

import { useEffect, useRef, useState } from "react"
import { cargarGoogleMaps, mapIdGoogle } from "@/src/lib/googleMaps"
import type { Punto } from "./SelectorUbicacionLeaflet"

// Mismo marcador del mapa libre (gota azul), para que se vea igual en los dos
const elementoMarcador = () => {
  const span = document.createElement("span")
  span.style.cssText = "display:block;width:22px;height:22px;border-radius:9999px 9999px 9999px 0;transform:rotate(-45deg);background:#0284c7;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"
  return span
}

// Mapa de Google para poner o corregir un punto: clic en el mapa o arrastrar el marcador.
// Mismas props que SelectorUbicacionLeaflet. Si Google no carga, avisa con onError.
export default function SelectorUbicacionGoogle({ punto, centroInicial, onCambiar, onError }: {
  punto: Punto | null
  centroInicial: Punto
  onCambiar: (p: Punto) => void
  onError: () => void
}) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<google.maps.Map | null>(null)
  const marcador = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  // Los oyentes del mapa se crean una vez: leen la función más reciente desde aquí
  const cambiar = useRef(onCambiar)
  const [listo, setListo] = useState(false)

  useEffect(() => { cambiar.current = onCambiar }, [onCambiar])

  // Crea el mapa una vez
  useEffect(() => {
    let cancelado = false
    cargarGoogleMaps()
      .then(maps => {
        if (cancelado || !contenedor.current) return
        const m = new maps.Map(contenedor.current, {
          center: { lat: centroInicial.latitud, lng: centroInicial.longitud },
          zoom: punto ? 16 : 12,
          mapId: mapIdGoogle,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          // Dentro de la ventana se acerca con la rueda sin tener que presionar Ctrl
          gestureHandling: "greedy",
          clickableIcons: false
        })
        m.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (e.latLng) cambiar.current({ latitud: e.latLng.lat(), longitud: e.latLng.lng() })
        })

        const pin = new maps.marker.AdvancedMarkerElement({ content: elementoMarcador(), gmpDraggable: true, title: "Ubicación" })
        pin.addListener("dragend", () => {
          const posicion = pin.position
          if (!posicion) return
          const { lat, lng } = posicion instanceof maps.LatLng ? posicion.toJSON() : posicion as google.maps.LatLngLiteral
          cambiar.current({ latitud: lat, longitud: lng })
        })

        mapa.current = m
        marcador.current = pin
        setListo(true)
      })
      .catch(() => { if (!cancelado) onError() })
    return () => {
      cancelado = true
      if (marcador.current) marcador.current.map = null
    }
    // Solo al abrir: después el punto se mueve en el efecto de abajo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mueve el marcador y centra el mapa cuando cambia el punto (clic, arrastre o "Buscar con Google")
  useEffect(() => {
    const m = mapa.current
    const pin = marcador.current
    if (!listo || !m || !pin) return
    if (!punto) {
      pin.map = null
      return
    }
    const posicion = { lat: punto.latitud, lng: punto.longitud }
    pin.position = posicion
    pin.map = m
    m.panTo(posicion)
    if ((m.getZoom() ?? 0) < 16) m.setZoom(16)
  }, [listo, punto?.latitud, punto?.longitud, punto])

  return (
    <div className="relative isolate h-full w-full">
      <div ref={contenedor} className="h-full w-full rounded-lg" />
      {!listo && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">Cargando mapa…</div>
      )}
    </div>
  )
}
