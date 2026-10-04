"use client"

import { useState } from "react"
import { formatoMoneda } from "@/src/lib/formato"
import type { BolsaTablero } from "@/src/schemas/gastos"

// Paleta categórica validada (orden fijo, nunca rotado). Los colores con
// contraste bajo (aqua, amarillo) se compensan con la leyenda, el tooltip y la tabla.
const SERIES = [
  { clave: "sinFactura", nombre: "Sin factura", color: "#2a78d6" },
  { clave: "porLegalizar", nombre: "Por legalizar", color: "#eb6834" },
  { clave: "reintegroPendiente", nombre: "Reintegro pendiente", color: "#1baf7a" },
  { clave: "recuperado", nombre: "Recuperado", color: "#eda100" },
  { clave: "asumido", nombre: "Gasto asumido (no reembolsable)", color: "#e87ba4" }
] as const

type Clave = typeof SERIES[number]["clave"]

// Reparte lo pagado de cada bolsa según dónde está hoy ese dinero
const segmentos = (b: BolsaTablero): Record<Clave, number> => ({
  sinFactura: b.sinFactura,
  porLegalizar: b.facturadoSinCuenta + b.enCuentaCobro,
  reintegroPendiente: b.reintegroPendiente,
  recuperado: b.legalizado + b.reintegrado,
  asumido: b.gastoAsumido
})

type Tooltip = { x: number, y: number, bolsa: string, serie: string, color: string, valor: number }

// Barras horizontales apiladas: una por bolsa, mismo eje para todas
export default function GraficoDineroPagado({ bolsas }: { bolsas: BolsaTablero[] }) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)

  const filas = bolsas
    .map(b => ({ bolsa: b, partes: segmentos(b) }))
    .filter(f => Object.values(f.partes).some(v => v > 0))

  const maximo = Math.max(1, ...filas.map(f => Object.values(f.partes).reduce((s, v) => s + v, 0)))

  if (filas.length === 0) {
    return <p className="py-10 text-center text-xs text-slate-400">No hay pagos en el rango seleccionado.</p>
  }

  return (
    <div className="relative" onPointerLeave={() => setTooltip(null)}>

      {/* Leyenda: siempre presente (más de una serie) */}
      <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
        {SERIES.map(s => (
          <li key={s.clave} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
            {s.nombre}
          </li>
        ))}
      </ul>

      <div className="space-y-4">
        {filas.map(({ bolsa, partes }) => (
          <div key={bolsa.id} className="grid grid-cols-[minmax(90px,140px)_1fr_auto] items-center gap-3">
            <p className="truncate text-xs font-medium text-slate-700" title={bolsa.nombre}>{bolsa.nombre}</p>

            {/* Barra: segmentos separados por 2px de superficie, extremo final redondeado */}
            <div className="flex h-5 gap-[2px]" role="img" aria-label={`${bolsa.nombre}: pagado ${formatoMoneda(bolsa.pagado)}`}>
              {SERIES.filter(s => partes[s.clave] > 0).map((s, i, visibles) => (
                <button
                  key={s.clave}
                  type="button"
                  className={`h-full transition-opacity hover:opacity-80 focus:opacity-80 focus:outline-none ${i === visibles.length - 1 ? "rounded-r" : ""}`}
                  style={{ width: `${(partes[s.clave] / maximo) * 100}%`, background: s.color, minWidth: 3 }}
                  aria-label={`${s.nombre}: ${formatoMoneda(partes[s.clave])}`}
                  onPointerMove={e => setTooltip({ x: e.clientX, y: e.clientY, bolsa: bolsa.nombre, serie: s.nombre, color: s.color, valor: partes[s.clave] })}
                  onFocus={e => {
                    const r = e.currentTarget.getBoundingClientRect()
                    setTooltip({ x: r.left + r.width / 2, y: r.top, bolsa: bolsa.nombre, serie: s.nombre, color: s.color, valor: partes[s.clave] })
                  }}
                  onBlur={() => setTooltip(null)}
                />
              ))}
            </div>

            {/* Valor al final de la barra */}
            <p className="text-xs font-semibold tabular-nums text-slate-700 whitespace-nowrap">{formatoMoneda(bolsa.pagado)}</p>
          </div>
        ))}
      </div>

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y - 10 }}
        >
          <p className="font-semibold tabular-nums text-slate-900">{formatoMoneda(tooltip.valor)}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-slate-500">
            <span className="inline-block h-0.5 w-3" style={{ background: tooltip.color }} aria-hidden="true" />
            {tooltip.serie} · {tooltip.bolsa}
          </p>
        </div>
      )}
    </div>
  )
}
