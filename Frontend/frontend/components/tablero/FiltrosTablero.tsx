"use client"

import { useRouter, useSearchParams } from "next/navigation"
import clsx from "clsx"
import type { OpcionFiltro } from "@/src/tablero"
import SelectBuscable from "@/components/ui/SelectBuscable"

// max-w-full: en el celular un select con opciones largas no ensancha la página
const claseControl = "h-9 max-w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"

const PRESETS = [
  { dias: 7, nombre: "7 días" },
  { dias: 30, nombre: "30 días" },
  { dias: 90, nombre: "90 días" }
]

const restarDias = (fecha: string, dias: number) =>
  new Date(Date.parse(`${fecha}T00:00:00Z`) - dias * 86400000).toISOString().slice(0, 10)

// Filtros en una fila sobre todo el tablero; quedan en la URL (se pueden compartir)
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

  const selector = (clave: string, vacio: string, opciones: OpcionFiltro[], extra?: React.ReactNode) => (
    <SelectBuscable value={parametros.get(clave) ?? ""} onChange={e => cambiar({ [clave]: e.target.value })} className={claseControl} aria-label={vacio}>
      <option value="">{vacio}</option>
      {extra}
      {opciones.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
    </SelectBuscable>
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Período: presets primero */}
      <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
        {PRESETS.map(p => (
          <button
            key={p.dias}
            type="button"
            onClick={() => cambiar({ desde: restarDias(hoy, p.dias - 1), hasta: hoy })}
            className={clsx(
              "h-8 rounded px-3 text-xs font-semibold transition",
              presetActivo === p.dias ? "bg-sky-500 text-white" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            {p.nombre}
          </button>
        ))}
      </div>
      <input type="date" value={desde} max={hasta} onChange={e => e.target.value && cambiar({ desde: e.target.value })} className={claseControl} aria-label="Desde" />
      <span className="text-xs text-slate-400">a</span>
      <input type="date" value={hasta} min={desde} max={hoy} onChange={e => e.target.value && cambiar({ hasta: e.target.value })} className={claseControl} aria-label="Hasta" />

      {mostrarAnalista && selector("analistaId", "Todos los analistas", analistas, <option value="sin">Sin analista</option>)}
      {selector("tramitadorId", "Todos los tramitadores", tramitadores)}
      {selector("operacionId", "Todas las operaciones", operaciones)}
      {selector("tramiteId", "Todos los tipos de trámite", tramites)}
      {selector("estadoId", "Todos los estados", estados)}

      {parametros.toString() && (
        <button type="button" onClick={() => router.push("/center/torreControl")} className="h-9 px-2 text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline">
          Limpiar filtros
        </button>
      )}
    </div>
  )
}
