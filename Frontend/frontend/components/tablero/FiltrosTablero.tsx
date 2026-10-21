"use client"

import { useRouter, useSearchParams } from "next/navigation"
import clsx from "clsx"
import type { OpcionFiltro } from "@/src/tablero"
import { X } from "lucide-react"
import SelectBuscable from "@/components/ui/SelectBuscable"
import { claseBotonSecundario, claseInput } from "@/components/ui/estilos"

// Mismo panel de filtros del Dashboard: etiquetas arriba y cuadrícula. Cada control llena su
// celda (las listas con búsqueda ocupan todo el ancho y en una fila suelta se veían disparejas).
// "Todos" en las listas con búsqueda es el texto guía: se pinta como en las listas cortas
const claseControl = `${claseInput} h-9 placeholder:!text-slate-700`
const claseEtiqueta = "block mb-1 text-[11px] font-medium text-slate-500"

const PRESETS = [
  { dias: 7, nombre: "7 días" },
  { dias: 30, nombre: "30 días" },
  { dias: 90, nombre: "90 días" }
]

const restarDias = (fecha: string, dias: number) =>
  new Date(Date.parse(`${fecha}T00:00:00Z`) - dias * 86400000).toISOString().slice(0, 10)

// Filtros sobre todo el tablero; se aplican al cambiar y quedan en la URL (se pueden compartir)
export default function FiltrosTablero({ hoy, desde, hasta, analistas, tramitadores, operaciones, tramites, estados, mostrarAnalista }: {
  hoy: string
  desde: string
  hasta: string
  analistas: OpcionFiltro[]
  tramitadores: OpcionFiltro[]
  operaciones: OpcionFiltro[]
  tramites: OpcionFiltro[]
  estados: OpcionFiltro[]
  // El analista solo ve lo suyo: no filtra por analista
  mostrarAnalista: boolean
}) {
  const router = useRouter()
  const parametros = useSearchParams()

  const cambiar = (cambios: Record<string, string>) => {
    const nuevos = new URLSearchParams(parametros.toString())
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) nuevos.set(clave, valor)
      else nuevos.delete(clave)
    }
    router.push(`/center/torreControl?${nuevos}`)
  }

  const presetActivo = hasta === hoy ? PRESETS.find(p => restarDias(hoy, p.dias - 1) === desde)?.dias : undefined

  const selector = (clave: string, etiqueta: string, vacio: string, opciones: OpcionFiltro[], extra?: React.ReactNode) => (
    <label className="block min-w-0">
      <span className={claseEtiqueta}>{etiqueta}</span>
      <SelectBuscable value={parametros.get(clave) ?? ""} onChange={e => cambiar({ [clave]: e.target.value })} className={claseControl} aria-label={etiqueta}>
        <option value="">{vacio}</option>
        {extra}
        {opciones.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
      </SelectBuscable>
    </label>
  )

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Período: atajos y fechas */}
        <div className="min-w-0 sm:col-span-2">
          <span className={claseEtiqueta}>Período</span>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex shrink-0 rounded-md border border-slate-200 bg-white p-0.5">
              {PRESETS.map(p => (
                <button
                  key={p.dias}
                  type="button"
                  onClick={() => cambiar({ desde: restarDias(hoy, p.dias - 1), hasta: hoy })}
                  className={clsx(
                    "h-7 rounded px-3 text-xs font-semibold transition",
                    presetActivo === p.dias ? "bg-sky-500 text-white" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {p.nombre}
                </button>
              ))}
            </div>
            <div className="flex min-w-[15rem] flex-1 items-center gap-2">
              <input type="date" value={desde} max={hasta} onChange={e => e.target.value && cambiar({ desde: e.target.value })} className={`${claseControl} min-w-0 flex-1`} aria-label="Desde" />
              <span className="text-xs text-slate-400">a</span>
              <input type="date" value={hasta} min={desde} max={hoy} onChange={e => e.target.value && cambiar({ hasta: e.target.value })} className={`${claseControl} min-w-0 flex-1`} aria-label="Hasta" />
            </div>
          </div>
        </div>

        {mostrarAnalista && selector("analistaId", "Analista", "Todos", analistas, <option value="sin">Sin analista</option>)}
        {selector("tramitadorId", "Tramitador", "Todos", tramitadores)}
        {selector("operacionId", "Operación", "Todas", operaciones)}
        {selector("tramiteId", "Tipo de trámite", "Todos", tramites)}
        {selector("estadoId", "Estado", "Todos", estados)}

        {parametros.toString() && (
          <div className="flex items-end">
            <button type="button" onClick={() => router.push("/center/torreControl")} className={`${claseBotonSecundario} h-9`}>
              <X size={14} /> Limpiar filtros
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
