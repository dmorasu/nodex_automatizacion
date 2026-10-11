"use client"

import { useState } from "react"
import clsx from "clsx"
import { formatoMoneda, formatoMonedaCorto } from "@/src/lib/formato"
import type { BolsaTablero } from "@/src/schemas/gastos"

// Paleta categórica validada (orden fijo, nunca rotado). Los colores con
// contraste bajo (aqua, amarillo) se compensan con la leyenda, el tooltip y la tabla.
const SERIES = [
  { clave: "sinFactura", nombre: "Sin factura", color: "#2a78d6" },
  { clave: "porLegalizar", nombre: "Por legalizar", color: "#eb6834" },
  { clave: "reintegroPendiente", nombre: "Reintegro pendiente", color: "#1baf7a" },
  { clave: "recuperado", nombre: "Recuperado", color: "#eda100" },
  { clave: "asumido", nombre: "Gasto asumido", color: "#e87ba4" }
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

// Escala con cortes redondos (1, 2, 2,5 o 5 × 10ⁿ) para que el eje se lea de un vistazo
const escala = (maximo: number, cortes = 4) => {
  const bruto = maximo / cortes
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  const paso = [1, 2, 2.5, 5, 10].map(m => m * potencia).find(p => p >= bruto) ?? bruto
  const tope = Math.ceil(maximo / paso) * paso
  return { tope, marcas: Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso) }
}

// Columnas de cada fila: nombre | barra | total (en el celular: nombre y total arriba, barra abajo)
const COLUMNAS = "grid grid-cols-[1fr_auto] items-center gap-x-3 sm:grid-cols-[150px_1fr_120px]"

const porcentaje = (parte: number, total: number) => total > 0 ? `${Math.round((parte / total) * 100)}%` : "0%"

type Tooltip = { x: number, y: number, bolsa: string, serie: string, color: string, valor: number, total: number }

// Barras horizontales apiladas: una por bolsa, mismo eje para todas, de mayor a menor
export default function GraficoDineroPagado({ bolsas }: { bolsas: BolsaTablero[] }) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  // Categoría resaltada (al pasar por un segmento o por la leyenda)
  const [resaltada, setResaltada] = useState<Clave | null>(null)

  const filas = bolsas
    .map(b => {
      const partes = segmentos(b)
      return { bolsa: b, partes, total: Object.values(partes).reduce((s, v) => s + v, 0) }
    })
    .filter(f => f.total > 0)
    .sort((a, b) => b.total - a.total)

  if (filas.length === 0) {
    return <p className="py-10 text-center text-xs text-slate-400">No hay pagos en el rango seleccionado.</p>
  }

  const { tope, marcas } = escala(Math.max(...filas.map(f => f.total)))
  const granTotal = filas.reduce((s, f) => s + f.total, 0)
  const totalSerie = (clave: Clave) => filas.reduce((s, f) => s + f.partes[clave], 0)
  const atenuada = (clave: Clave) => resaltada !== null && resaltada !== clave

  const soltar = () => { setTooltip(null); setResaltada(null) }

  return (
    <div className="relative" onPointerLeave={soltar}>

      {/* Leyenda: identifica cada color y dice cuánto suma la categoría en todas las bolsas */}
      <ul className="mb-6 grid grid-cols-2 gap-2 lg:grid-cols-5">
        {SERIES.map(s => {
          const valor = totalSerie(s.clave)
          return (
            <li
              key={s.clave}
              onPointerEnter={() => setResaltada(s.clave)}
              onPointerLeave={() => setResaltada(null)}
              className={clsx("rounded-lg border border-slate-200 px-3 py-2 transition-opacity", atenuada(s.clave) && "opacity-40")}
            >
              <p className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
                <span className="truncate" title={s.nombre}>{s.nombre}</span>
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">
                {formatoMoneda(valor)}
                <span className="ml-1.5 text-[11px] font-medium text-slate-400">{porcentaje(valor, granTotal)}</span>
              </p>
            </li>
          )
        })}
      </ul>

      {/* Cada fila usa las mismas columnas fijas, así las barras comparten eje. En el celular el
          nombre y el total van en una línea y la barra ocupa todo el ancho debajo. */}
      <div className="space-y-2 sm:space-y-0">
        {filas.map(({ bolsa, partes, total }) => (
          <div key={bolsa.id} className={COLUMNAS}>
            <p className="truncate text-xs font-medium text-slate-700 sm:col-start-1" title={bolsa.nombre}>{bolsa.nombre}</p>

            {/* Valor al final de la barra */}
            <p className="whitespace-nowrap text-right text-xs font-semibold tabular-nums text-slate-700 sm:col-start-3 sm:row-start-1">
              {formatoMoneda(total)}
            </p>

            {/* Barra: segmentos separados por 2px de superficie, extremo final redondeado; líneas guía detrás */}
            <div
              className="relative col-span-2 flex h-9 items-center sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:h-10"
              role="img"
              aria-label={`${bolsa.nombre}: pagado ${formatoMoneda(total)}`}
            >
              {marcas.map(m => (
                <span key={m} className="absolute inset-y-0 w-px bg-slate-100" style={{ left: `${(m / tope) * 100}%` }} aria-hidden="true" />
              ))}
              <div className="relative flex h-6 gap-[2px]" style={{ width: `${(total / tope) * 100}%` }}>
                {SERIES.filter(s => partes[s.clave] > 0).map((s, i, visibles) => (
                  <button
                    key={s.clave}
                    type="button"
                    className={clsx(
                      "h-full transition-opacity focus:outline-none",
                      i === visibles.length - 1 && "rounded-r",
                      atenuada(s.clave) && "opacity-25"
                    )}
                    style={{ flexGrow: partes[s.clave], flexBasis: 0, background: s.color, minWidth: 3 }}
                    aria-label={`${s.nombre}: ${formatoMoneda(partes[s.clave])}`}
                    onPointerMove={e => {
                      setResaltada(s.clave)
                      setTooltip({ x: e.clientX, y: e.clientY, bolsa: bolsa.nombre, serie: s.nombre, color: s.color, valor: partes[s.clave], total })
                    }}
                    onFocus={e => {
                      const r = e.currentTarget.getBoundingClientRect()
                      setResaltada(s.clave)
                      setTooltip({ x: r.left + r.width / 2, y: r.top, bolsa: bolsa.nombre, serie: s.nombre, color: s.color, valor: partes[s.clave], total })
                    }}
                    onBlur={soltar}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* Eje: montos redondos bajo las líneas guía */}
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

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y - 10 }}
        >
          <p className="font-semibold tabular-nums text-slate-900">
            {formatoMoneda(tooltip.valor)}
            <span className="ml-1.5 font-medium text-slate-400">{porcentaje(tooltip.valor, tooltip.total)} de la bolsa</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-slate-500">
            <span className="inline-block h-0.5 w-3" style={{ background: tooltip.color }} aria-hidden="true" />
            {tooltip.serie} · {tooltip.bolsa}
          </p>
        </div>
      )}
    </div>
  )
}
