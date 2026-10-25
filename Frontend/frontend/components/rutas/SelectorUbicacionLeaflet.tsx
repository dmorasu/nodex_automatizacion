"use client"

import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useEffect } from "react"
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet"

export type Punto = { latitud: number, longitud: number }

const icono = L.divIcon({
  className: "",
  html: `<span style="display:block;width:22px;height:22px;border-radius:9999px 9999px 9999px 0;transform:rotate(-45deg);background:#0284c7;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
  iconSize: [22, 22],
  iconAnchor: [11, 22]
})

function Clic({ onCambiar }: { onCambiar: (p: Punto) => void }) {
  useMapEvents({ click: e => onCambiar({ latitud: e.latlng.lat, longitud: e.latlng.lng }) })
  return null
}

function Centrar({ punto }: { punto: Punto | null }) {
  const mapa = useMap()
  useEffect(() => {
    if (punto) mapa.setView([punto.latitud, punto.longitud], Math.max(mapa.getZoom(), 16))
  }, [mapa, punto?.latitud, punto?.longitud])
  return null
}

// Mapa para poner o corregir un punto: clic en el mapa o arrastrar el marcador
export default function SelectorUbicacionLeaflet({ punto, centroInicial, onCambiar }: {
  punto: Punto | null
  centroInicial: Punto
  onCambiar: (p: Punto) => void
}) {
  return (
    <MapContainer center={[centroInicial.latitud, centroInicial.longitud]} zoom={punto ? 16 : 12} className="isolate h-full w-full rounded-lg">
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <Clic onCambiar={onCambiar} />
      <Centrar punto={punto} />
      {punto && (
        <Marker
          position={[punto.latitud, punto.longitud]}
          icon={icono}
          draggable
          eventHandlers={{
            dragend: e => {
              const { lat, lng } = (e.target as L.Marker).getLatLng()
              onCambiar({ latitud: lat, longitud: lng })
            }
          }}
        />
      )}
    </MapContainer>
  )
}
