"use client"

import "leaflet/dist/leaflet.css"
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet"
import type { FilaMunicipio } from "@/src/tablero"

// Centro aproximado de Colombia
const CENTRO: [number, number] = [4.6, -74.3]

// Mapa con un círculo por municipio: el tamaño es la cantidad de abiertos.
// Va en su propio archivo porque Leaflet solo funciona en el navegador (se carga con dynamic).
export default function MapaMunicipiosLeaflet({ municipios }: { municipios: FilaMunicipio[] }) {
  const maximo = Math.max(1, ...municipios.map(m => m.abiertos))
  const radio = (abiertos: number) => 5 + Math.sqrt(abiertos / maximo) * 22

  return (
    <MapContainer center={CENTRO} zoom={5} scrollWheelZoom={false} className="h-full w-full rounded-lg" attributionControl>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {municipios.map(m => (
        <CircleMarker
          key={m.municipioId}
          center={[m.latitud!, m.longitud!]}
          radius={radio(m.abiertos)}
          // Anillo blanco de 2px para separar círculos que se tocan
          pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#0284c7", fillOpacity: 0.7 }}
        >
          <Tooltip direction="top" offset={[0, -4]}>
            <span className="block text-[11px] text-slate-500">{m.municipio}{m.departamento && m.departamento !== m.municipio ? ` · ${m.departamento}` : ""}</span>
            <span className="block text-xs"><b>{m.abiertos}</b> abiertos</span>
            <span className="block text-xs"><b>{m.vencidos}</b> vencidos</span>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
