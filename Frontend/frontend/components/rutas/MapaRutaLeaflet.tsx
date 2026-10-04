"use client"

import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useEffect } from "react"
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet"
import { COLOR_ESTADO, NOMBRE_ESTADO_PARADA, type Parada, type Sede } from "@/src/rutas"

// Marcador numerado con anillo blanco (se distingue aunque se toquen)
const iconoParada = (numero: number, estado: Parada["estado"]) => L.divIcon({
  className: "",
  html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:${COLOR_ESTADO[estado]};color:#fff;font:600 11px system-ui;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)">${numero}</span>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13]
})

const iconoSede = L.divIcon({
  className: "",
  html: `<span style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:8px;background:#0f172a;color:#fff;font:700 11px system-ui;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)">S</span>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
})

// Ajusta el zoom para que se vean todas las paradas
function Encuadre({ puntos }: { puntos: [number, number][] }) {
  const mapa = useMap()
  useEffect(() => {
    if (puntos.length === 1) mapa.setView(puntos[0], 14)
    else if (puntos.length > 1) mapa.fitBounds(puntos, { padding: [30, 30] })
  }, [mapa, JSON.stringify(puntos)])
  return null
}

export default function MapaRutaLeaflet({ sede, paradas }: { sede: Sede | null, paradas: Parada[] }) {
  const ubicadas = paradas.filter(p => p.latitud !== null && p.longitud !== null)
  const sedeUbicada = sede && sede.latitud !== null && sede.longitud !== null ? sede : null

  // Recorrido en orden (línea recta entre paradas; las calles las da Google Maps al navegar)
  const recorrido: [number, number][] = [
    ...(sedeUbicada ? [[sedeUbicada.latitud!, sedeUbicada.longitud!] as [number, number]] : []),
    ...ubicadas.map(p => [p.latitud!, p.longitud!] as [number, number])
  ]

  return (
    <MapContainer center={recorrido[0] ?? [4.6, -74.1]} zoom={12} scrollWheelZoom={false} className="h-full w-full rounded-lg">
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <Encuadre puntos={recorrido} />

      {recorrido.length > 1 && (
        <Polyline positions={recorrido} pathOptions={{ color: "#64748b", weight: 2, dashArray: "6 6" }} />
      )}

      {sedeUbicada && (
        <Marker position={[sedeUbicada.latitud!, sedeUbicada.longitud!]} icon={iconoSede}>
          <Tooltip direction="top" offset={[0, -12]}>
            <b>Sede {sedeUbicada.nombre}</b><br />{sedeUbicada.direccion}
          </Tooltip>
        </Marker>
      )}

      {ubicadas.map(p => (
        <Marker key={p.id} position={[p.latitud!, p.longitud!]} icon={iconoParada(p.orden, p.estado)}>
          <Tooltip direction="top" offset={[0, -12]}>
            <b>{p.orden}. Trámite #{p.tramiteId}</b> · {NOMBRE_ESTADO_PARADA[p.estado]}<br />
            {p.cliente ?? "Sin cliente"}<br />
            {p.direccion ?? "Sin dirección"}{p.municipio ? `, ${p.municipio}` : ""}
            {p.ubicacionPrecisa === false && <><br /><i>Ubicación aproximada</i></>}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  )
}
