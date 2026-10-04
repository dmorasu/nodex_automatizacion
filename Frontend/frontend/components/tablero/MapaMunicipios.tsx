"use client"

import dynamic from "next/dynamic"
import type { FilaMunicipio } from "@/src/tablero"

// Leaflet usa `window`: se carga solo en el navegador
const Mapa = dynamic(() => import("./MapaMunicipiosLeaflet"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">Cargando mapa…</div>
})

// Dónde están los trámites abiertos: mapa por municipio y la lista de los que más tienen
export default function MapaMunicipios({ municipios }: { municipios: FilaMunicipio[] }) {
  const conUbicacion = municipios.filter(m => m.latitud !== null && m.longitud !== null)
  const sinUbicacion = municipios.length - conUbicacion.length
  const maximo = Math.max(1, ...municipios.map(m => m.abiertos))

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-700">Trámites abiertos por municipio</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          El tamaño del círculo es la cantidad de abiertos; pase el mouse para ver los vencidos.
          {sinUbicacion > 0 && ` ${sinUbicacion} municipio(s) sin coordenadas no aparecen en el mapa.`}
        </p>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_260px]">
        <div className="relative z-0 h-[380px]">
          {conUbicacion.length > 0
            ? <Mapa municipios={conUbicacion} />
            : <div className="flex h-full items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">Sin trámites abiertos con ubicación.</div>}
        </div>

        {/* Lista: también da acceso a los números sin usar el mapa */}
        <ol className="max-h-[380px] space-y-2.5 overflow-y-auto pr-1">
          {municipios.slice(0, 20).map(m => (
            <li key={m.municipioId ?? "sin"} className="text-xs">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-slate-600" title={m.departamento ?? undefined}>{m.municipio}</span>
                <span className="shrink-0 text-slate-400">
                  <b className="text-slate-700">{m.abiertos}</b>
                  {m.vencidos > 0 && <span className="text-red-600"> · {m.vencidos} venc.</span>}
                </span>
              </div>
              <span className="block h-1.5 overflow-hidden rounded-r bg-slate-50" aria-hidden="true">
                <span className="block h-full rounded-r bg-[#0284c7]" style={{ width: `${(m.abiertos / maximo) * 100}%` }} />
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
