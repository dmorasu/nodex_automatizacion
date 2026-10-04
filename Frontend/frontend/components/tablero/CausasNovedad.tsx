"use client"

import { useState } from "react"
import clsx from "clsx"
import type { Conteo, Tablero } from "@/src/tablero"

const VISTAS = [
  { clave: "porTipo", nombre: "Tipo de rechazo" },
  { clave: "porEntidad", nombre: "Entidad" },
  { clave: "porMunicipio", nombre: "Municipio" }
] as const

// Barras horizontales de una sola serie; el número va siempre visible al lado
function Barras({ datos, total }: { datos: Conteo[], total: number }) {
  const maximo = Math.max(1, ...datos.map(d => d.cantidad))
  return (
    <ul className="space-y-2.5">
      {datos.map(d => (
        <li key={d.nombre} className="text-xs">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-slate-600" title={d.nombre}>{d.nombre}</span>
            <span className="shrink-0 text-slate-400">
              <b className="text-slate-700">{d.cantidad}</b> · {total ? Math.round((d.cantidad / total) * 100) : 0} %
            </span>
          </div>
          <span className="block h-2 overflow-hidden rounded-r bg-slate-50" aria-hidden="true">
            <span className="block h-full rounded-r bg-[#0284c7]" style={{ width: `${(d.cantidad / maximo) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  )
}

// Por qué se frenan los trámites: pasos a "En espera por novedad" en el período
export default function CausasNovedad({ causas }: { causas: Tablero["causasNovedad"] }) {
  const [vista, setVista] = useState<(typeof VISTAS)[number]["clave"]>("porTipo")

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Causas de novedad</h2>
          <p className="mt-0.5 text-xs text-slate-400">{causas.total.toLocaleString("es-CO")} novedades registradas en el período</p>
        </div>
        <div className="inline-flex rounded-md border border-slate-200 p-0.5">
          {VISTAS.map(v => (
            <button
              key={v.clave}
              type="button"
              onClick={() => setVista(v.clave)}
              aria-pressed={vista === v.clave}
              className={clsx("h-7 rounded px-2.5 text-[11px] font-semibold", vista === v.clave ? "bg-sky-500 text-white" : "text-slate-600 hover:bg-slate-50")}
            >
              {v.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-4">
        {causas.total === 0
          ? <p className="py-6 text-center text-xs text-slate-400">Sin novedades en el período.</p>
          : <Barras datos={causas[vista]} total={causas.total} />}
      </div>
    </section>
  )
}
