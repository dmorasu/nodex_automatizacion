"use client"

import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useEffect } from "react"
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet"
import { COLOR_ESTADO, NOMBRE_ESTADO_PARADA, puntosRuta, type Parada, type PuntoMapa, type RutaEnMapa } from "@/src/rutas"

// Marcador numerado: relleno del color del mensajero y borde del color del estado
const iconoParada = (numero: number, color: string, estado: Parada["estado"]) => L.divIcon({
  className: "",
  html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:${color};color:#fff;font:600 11px system-ui;border:3px solid ${estado === "PENDIENTE" ? "#fff" : COLOR_ESTADO[estado]};box-shadow:0 1px 3px rgba(0,0,0,.35)">${numero}</span>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13]
})

const iconoSede = L.divIcon({
  className: "",
  html: `<span style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:8px;background:#0f172a;color:#fff;font:700 11px system-ui;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)">S</span>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15]
})

// Ajusta el zoom para que se vean todas las rutas
function Encuadre({ puntos }: { puntos: PuntoMapa[] }) {
  const mapa = useMap()
  const clave = JSON.stringify(puntos)
  useEffect(() => {
    if (puntos.length === 1) mapa.setView(puntos[0], 14)
    else if (puntos.length > 1) mapa.fitBounds(puntos, { padding: [30, 30] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa, clave])
  return null
}

// Mapa gratuito (OpenStreetMap) con las rutas de varios mensajeros. Se usa cuando no hay
// clave de Google Maps para el navegador; si el backend tiene Google, igual dibuja las calles.
export default function MapaRutaLeaflet({ rutas }: { rutas: RutaEnMapa[] }) {
  const todos = rutas.flatMap(r => r.trazado ?? puntosRuta(r.sede, r.paradas))
  const sedes = [...new Map(rutas.filter(r => r.sede && r.sede.latitud !== null && r.sede.longitud !== null).map(r => [r.sede!.id, r.sede!])).values()]

  return (
    <MapContainer center={todos[0] ?? [4.6, -74.1]} zoom={todos.length ? 12 : 6} scrollWheelZoom={false} className="h-full w-full rounded-lg">
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <Encuadre puntos={todos} />

      {rutas.map(ruta => {
        const camino = ruta.trazado ?? puntosRuta(ruta.sede, ruta.paradas)
        return camino.length > 1 && (
          <Polyline key={`linea-${ruta.id}`} positions={camino}
            pathOptions={{ color: ruta.color, weight: ruta.trazado ? 4 : 3, opacity: 0.85, dashArray: ruta.trazado ? undefined : "6 6" }} />
        )
      })}

      {sedes.map(sede => (
        <Marker key={`sede-${sede.id}`} position={[sede.latitud!, sede.longitud!]} icon={iconoSede}>
          <Tooltip direction="top" offset={[0, -12]}>
            <b>Sede {sede.nombre}</b><br />{sede.direccion}
          </Tooltip>
        </Marker>
      ))}

      {rutas.flatMap(ruta => ruta.paradas
        .filter(p => p.latitud !== null && p.longitud !== null)
        .map(p => (
          <Marker key={p.id} position={[p.latitud!, p.longitud!]} icon={iconoParada(p.orden, ruta.color, p.estado)}>
            <Tooltip direction="top" offset={[0, -12]}>
              <b style={{ color: ruta.color }}>{ruta.nombre}</b><br />
              <b>{p.orden}. Trámite #{p.tramiteId}</b> · {NOMBRE_ESTADO_PARADA[p.estado]}<br />
              {p.cliente ?? "Sin cliente"}<br />
              {p.direccion ?? "Sin dirección"}{p.municipio ? `, ${p.municipio}` : ""}
              {p.ubicacionPrecisa === false && <><br /><i>Ubicación aproximada</i></>}
            </Tooltip>
          </Marker>
        )))}
    </MapContainer>
  )
}
