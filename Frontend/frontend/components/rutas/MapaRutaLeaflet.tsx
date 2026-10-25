"use client"

import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useEffect } from "react"
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet"
import { COLOR_ESTADO, MINUTOS_SIN_SENAL, NOMBRE_ESTADO_PARADA, haceMinutos, horaCorta, iniciales, puntosRuta, type Parada, type PuntoMapa, type RutaEnMapa } from "@/src/rutas"

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

// Mensajero en vivo: iniciales en su color con halo; gris si no hay señal reciente
const iconoEnVivo = (nombre: string, color: string, sinSenal: boolean) => L.divIcon({
  className: "",
  html: `<span style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:${sinSenal ? "#94a3b8" : color};color:#fff;font:700 11px system-ui;border:3px solid #fff;box-shadow:0 0 0 ${sinSenal ? "1px #94a3b8" : `5px ${color}55`},0 1px 4px rgba(0,0,0,.35)">${iniciales(nombre)}</span>`,
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
  const planeados = rutas.flatMap(r => r.trazado ?? puntosRuta(r.sede, r.paradas))
  // Si no hay ruta planeada (mensajero sin paradas), se encuadra en su posición en vivo
  const todos = planeados.length ? planeados : rutas.flatMap(r => (r.enVivo ? [[r.enVivo.latitud, r.enVivo.longitud] as PuntoMapa] : []))
  const sedes = [...new Map(rutas.filter(r => r.sede && r.sede.latitud !== null && r.sede.longitud !== null).map(r => [r.sede!.id, r.sede!])).values()]

  return (
    <MapContainer center={todos[0] ?? [4.6, -74.1]} zoom={todos.length ? 12 : 6} scrollWheelZoom={false} className="isolate h-full w-full rounded-lg">
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

      {/* Recorrido real: visitas confirmadas en orden de hora (punteado de puntos) */}
      {rutas.map(ruta => ruta.recorrido.length > 1 && (
        <Polyline key={`recorrido-${ruta.id}`} positions={ruta.recorrido.map(p => [p.latitud, p.longitud] as PuntoMapa)}
          pathOptions={{ color: ruta.color, weight: 5, opacity: 0.95, dashArray: "1 9", lineCap: "round" }} />
      ))}
      {rutas.flatMap(ruta => ruta.recorrido.filter(p => p.titulo !== "Posición en vivo").map(p => (
        <CircleMarker key={`visita-${ruta.id}-${p.hora}`} center={[p.latitud, p.longitud]} radius={5}
          pathOptions={{ color: "#fff", weight: 2, fillColor: ruta.color, fillOpacity: 1 }}>
          <Tooltip direction="top">{ruta.nombre} · {p.titulo} · {horaCorta(p.hora)}</Tooltip>
        </CircleMarker>
      )))}

      {/* Posición en vivo de cada mensajero */}
      {rutas.map(ruta => ruta.enVivo && (
        <Marker key={`vivo-${ruta.id}`} position={[ruta.enVivo.latitud, ruta.enVivo.longitud]} zIndexOffset={1000}
          icon={iconoEnVivo(ruta.nombre, ruta.color, ruta.enVivo.minutos > MINUTOS_SIN_SENAL)}>
          <Tooltip direction="top" offset={[0, -14]}>
            <b style={{ color: ruta.color }}>{ruta.nombre}</b><br />
            {ruta.enVivo.minutos > MINUTOS_SIN_SENAL ? "Sin señal" : "En vivo"} · {haceMinutos(ruta.enVivo.minutos)} ({horaCorta(ruta.enVivo.registradaEn)})
            {ruta.enVivo.precisionMetros !== null && <><br />Precisión ± {ruta.enVivo.precisionMetros} m</>}
          </Tooltip>
        </Marker>
      ))}

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
