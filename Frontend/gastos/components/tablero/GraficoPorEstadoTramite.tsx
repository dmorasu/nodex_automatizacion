"use client"

import { useState } from "react"
import clsx from "clsx"
import { formatoMoneda, formatoMonedaCorto } from "@/src/lib/formato"
import type { EstadoTramiteTablero } from "@/src/schemas/gastos"

// Una sola serie (pagado): un solo color, el primero de la paleta del tablero; el título la nombra
const COLOR = "#2a78d6"

// Mismo eje redondo y mismas columnas que "¿Dónde está el dinero pagado?"
const escala = (maximo: number, cortes = 4) => {
  const bruto = maximo / cortes
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  const paso = [1, 2, 2.5, 5, 10].map(m => m * potencia).find(p => p >= bruto) ?? bruto
  const tope = Math.ceil(maximo / paso) * paso
  return { tope, marcas: Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso) }
}

const COLUMNAS = "grid grid-cols-[1fr_auto] items-center gap-x-3 sm:grid-cols-[200px_1fr_120px]"

const porcentaje = (parte: number, total: number) => total > 0 ? `${Math.round((parte / total) * 100)}%` : "0%"

type Tooltip = { x: number, y: number, fila: EstadoTramiteTablero }

// Pagado en gastos con trámite, por el estado actual del trámite: barras horizontales de mayor a
// menor y, debajo, la tabla con los valores exactos
export default function GraficoPorEstadoTramite({ estados }: { estados: EstadoTramiteTablero[] }) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const filas = estados.filter(f => f.pagado > 0).sort((a, b) => b.pagado - a.pagado)

  if (filas.length === 0) {
    return <p className="py-10 text-center text-xs text-slate-400">No hay pagos de gastos con trámite en el rango seleccionado.</p>
  }

  const { tope, marcas } = escala(Math.max(...filas.map(f => f.pagado)))
  const total = filas.reduce((s, f) => s + f.pagado, 0)
  const totalTramites = filas.reduce((s, f) => s + f.tramites, 0)
  const totalGastos = filas.reduce((s, f) => s + f.gastos, 0)

  return (
    <div className="relative space-y-6" onPointerLeave={() => setTooltip(null)}>
      <div className="space-y-2 sm:space-y-0">
        {filas.map(fila => (
          <div key={fila.estado} className={COLUMNAS}>
            <p className="truncate text-xs font-medium text-slate-700 sm:col-start-1" title={fila.estado}>{fila.estado}</p>
            <p className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-slate-700 sm:col-start-3 sm:row-start-1">
              {formatoMoneda(fila.pagado)}
            </p>
            <div className="relative col-span-2 flex h-9 items-center sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:h-10">
              {marcas.map(m => (
                <span key={m} className="absolute inset-y-0 w-px bg-slate-100" style={{ left: `${(m / tope) * 100}%` }} aria-hidden="true" />
              ))}
              {/* Zona de toque de toda la fila: más grande que la barra */}
              <button
                type="button"
                className="relative flex h-full w-full items-center focus:outline-none"
                aria-label={`${fila.estado}: pagado ${formatoMoneda(fila.pagado)}, ${fila.tramites} trámite(s), ${fila.gastos} gasto(s)`}
                onPointerMove={e => setTooltip({ x: e.clientX, y: e.clientY, fila })}
                onFocus={e => {
                  const r = e.currentTarget.getBoundingClientRect()
                  setTooltip({ x: r.left + r.width / 2, y: r.top, fila })
                }}
                onBlur={() => setTooltip(null)}
              >
                <span
                  className={clsx("h-6 rounded-r transition-opacity", tooltip && tooltip.fila.estado !== fila.estado && "opacity-40")}
                  style={{ width: `${(fila.pagado / tope) * 100}%`, minWidth: 3, background: COLOR }}
                />
              </button>
            </div>
          </div>
        ))}

        <div className={COLUMNAS} aria-hidden="true">
          <div className="relative col-span-2 mt-1 h-4 text-[10px] tabular-nums text-slate-400 sm:col-span-1 sm:col-start-2">
            {marcas.map((m, i) => (
              <span
                key={m}
                className={clsx("absolute whitespace-nowrap", i === 0 ? "" : i === marcas.length - 1 ? "-translate-x-full" : "-translate-x-1/2")}
                style={{ left: `${(m / tope) * 100}%` }}
              >
                {formatoMonedaCorto(m)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full text-left text-xs tabular-nums">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3 font-semibold">Estado del trámite</th>
              <th className="px-3 py-3 font-semibold text-right">Trámites</th>
              <th className="px-3 py-3 font-semibold text-right">Gastos</th>
              <th className="px-3 py-3 font-semibold text-right">Pagado</th>
              <th className="px-3 py-3 font-semibold text-right">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.map(f => (
              <tr key={f.estado}>
                <td className="px-3 py-3 font-medium text-slate-700">{f.estado}</td>
                <td className="px-3 py-3 text-right">{f.tramites}</td>
                <td className="px-3 py-3 text-right">{f.gastos}</td>
                <td className="px-3 py-3 text-right font-semibold text-slate-800">{formatoMoneda(f.pagado)}</td>
                <td className="px-3 py-3 text-right text-slate-500">{porcentaje(f.pagado, total)}</td>
              </tr>
            ))}
          </tbody>
          {filas.length > 1 && (
            <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-800">
              <tr>
                <td className="px-3 py-3">Total</td>
                <td className="px-3 py-3 text-right">{totalTramites}</td>
                <td className="px-3 py-3 text-right">{totalGastos}</td>
                <td className="px-3 py-3 text-right">{formatoMoneda(total)}</td>
                <td className="px-3 py-3 text-right">100%</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y - 10 }}
        >
          <p className="font-semibold tabular-nums text-slate-900">
            {formatoMoneda(tooltip.fila.pagado)}
            <span className="ml-1.5 font-medium text-slate-400">{porcentaje(tooltip.fila.pagado, total)} del pagado con trámite</span>
          </p>
          <p className="mt-0.5 text-slate-500">{tooltip.fila.estado} · {tooltip.fila.tramites} trámite(s) · {tooltip.fila.gastos} gasto(s)</p>
        </div>
      )}
    </div>
  )
}
