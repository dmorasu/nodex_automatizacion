"use client"

import { useState } from "react"
import type { Tablero } from "@/src/tablero"

const NOMBRES: Record<string, string> = {
  "0-7": "0 a 7 días",
  "8-15": "8 a 15 días",
  "16-30": "16 a 30 días",
  ">30": "Más de 30 días"
}

// Una sola serie (cantidad de abiertos por antigüedad); el detalle por estado va en la tabla
export default function Antiguedad({ antiguedad }: { antiguedad: Tablero["antiguedad"] }) {
  const [verTabla, setVerTabla] = useState(false)
  const maximo = Math.max(1, ...antiguedad.rangos.map(r => r.total))

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Antigüedad de los abiertos</h2>
          <p className="mt-0.5 text-xs text-slate-400">Días desde que se creó el trámite</p>
        </div>
        <button type="button" onClick={() => setVerTabla(v => !v)} className="text-[11px] font-medium text-sky-600 hover:underline">
          {verTabla ? "Ver gráfica" : "Ver por estado"}
        </button>
      </div>

      <div className="px-5 py-4">
        {verTabla ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-1.5 pr-3 font-semibold">Estado</th>
                  {antiguedad.rangos.map(r => <th key={r.rango} className="px-2 py-1.5 text-right font-semibold">{r.rango} d</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {antiguedad.estados.map(estado => (
                  <tr key={estado}>
                    <td className="py-1.5 pr-3 text-slate-600">{estado}</td>
                    {antiguedad.rangos.map(r => (
                      <td key={r.rango} className="px-2 py-1.5 text-right text-slate-700">{r.porEstado[estado] || <span className="text-slate-300">0</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="space-y-3">
            {antiguedad.rangos.map(r => (
              <li key={r.rango} className="flex items-center gap-3 text-xs" title={antiguedad.estados.map(e => `${e}: ${r.porEstado[e] ?? 0}`).join(" · ")}>
                <span className="w-24 shrink-0 text-slate-500">{NOMBRES[r.rango] ?? r.rango}</span>
                <span className="h-3 flex-1 overflow-hidden rounded-r bg-slate-50">
                  <span className="block h-full rounded-r bg-[#0284c7]" style={{ width: `${(r.total / maximo) * 100}%`, minWidth: r.total > 0 ? 2 : 0 }} />
                </span>
                <b className="w-10 shrink-0 text-right text-slate-700">{r.total.toLocaleString("es-CO")}</b>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
