"use client"

import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import clsx from "clsx"
import { formatoFecha, formatoMoneda } from "@/src/lib/formato"

export type RegistroCentro = {
  id: number
  codigo: string
  grupo: "FACTURADO" | "POR_FACTURAR" | "ANTICIPOS"
  estado: string
  cliente: string | null
  fechaConsignacion: string
  identificacion: string | null
  base: number
  iva: number
  total: number
  factura: string | null
}

const GRUPO: Record<RegistroCentro["grupo"], { texto: string, clase: string }> = {
  FACTURADO: { texto: "Facturado", clase: "bg-emerald-50 text-emerald-700" },
  POR_FACTURAR: { texto: "Por facturar", clase: "bg-amber-50 text-amber-700" },
  ANTICIPOS: { texto: "Anticipo", clase: "bg-sky-50 text-sky-700" }
}

const MAXIMO = 10
const ANCHO = 448

// Al pasar el mouse (o enfocar con el teclado) sobre un centro de costos del reporte, muestra sus
// registros más recientes con su valor, como un adelanto del detalle del Excel. Flota sobre la
// página (fixed) porque la tabla está en un contenedor con desplazamiento que la recortaría
export default function VistaPreviaCentro({ centro, registros, children }: {
  centro: string
  registros: RegistroCentro[]
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [posicion, setPosicion] = useState<{ top: number, left: number } | null>(null)

  const abrir = () => {
    const caja = ref.current?.getBoundingClientRect()
    if (!caja || !registros.length) return
    const alto = Math.min(window.innerHeight * 0.7, 520)
    setPosicion({
      // Junto a la fila; si no cabe abajo, se sube lo necesario
      top: Math.max(8, Math.min(caja.top, window.innerHeight - alto - 8)),
      left: Math.min(caja.right + 8, window.innerWidth - ANCHO - 8)
    })
  }
  const cerrar = () => setPosicion(null)

  const visibles = registros.slice(0, MAXIMO)

  return (
    <div ref={ref} onMouseEnter={abrir} onMouseLeave={cerrar} onFocus={abrir} onBlur={cerrar} tabIndex={0} className="cursor-default outline-none">
      {children}
      {posicion && createPortal(
        <div
          role="tooltip"
          style={{ top: posicion.top, left: posicion.left, width: ANCHO }}
          className="pointer-events-none fixed z-50 max-h-[70vh] overflow-hidden rounded-xl border border-slate-200 bg-white text-xs shadow-xl"
        >
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
            <p className="font-semibold text-slate-800">{centro}</p>
            <p className="text-[11px] text-slate-400">{registros.length} registro(s) · los más recientes primero</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {visibles.map(r => (
              <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700">{r.codigo}</span>
                    <span className={clsx("rounded px-1.5 py-0.5 text-[10px] font-medium", GRUPO[r.grupo].clase)}>{GRUPO[r.grupo].texto}</span>
                    {r.grupo !== "FACTURADO" && <span className="text-[10px] text-slate-400">{r.estado}</span>}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">{r.cliente ?? "—"}{r.identificacion && ` · ${r.identificacion}`}</p>
                  <p className="text-[11px] text-slate-400">
                    Consignado {formatoFecha(r.fechaConsignacion)}{r.factura && ` · Factura ${r.factura}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-medium text-slate-800 tabular-nums">{formatoMoneda(r.total)}</p>
                  {r.iva > 0 && <p className="text-[10px] text-slate-400 tabular-nums">Base {formatoMoneda(r.base)} · IVA {formatoMoneda(r.iva)}</p>}
                </div>
              </li>
            ))}
          </ul>
          {registros.length > MAXIMO && (
            <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
              Y {registros.length - MAXIMO} más: el detalle completo está en el Excel.
            </p>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
