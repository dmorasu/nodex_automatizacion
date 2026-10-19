"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "react-toastify"
import { ChevronLeft, ChevronRight, Loader2, LocateFixed } from "lucide-react"
import { llamarApi } from "@/src/lib/apiCliente"
import type { Sede } from "@/src/rutas"
import SelectBuscable from "@/components/ui/SelectBuscable"

const claseControl = "h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"

const moverDias = (fecha: string, dias: number) =>
  new Date(Date.parse(`${fecha}T12:00:00Z`) + dias * 86400000).toISOString().slice(0, 10)

// Día, sede y "ubicar pendientes con Google"
export default function BarraRutas({ fecha, hoy, sedes, sinUbicacion, googleDisponible }: {
  fecha: string
  hoy: string
  sedes: Sede[]
  sinUbicacion: number
  googleDisponible: boolean
}) {
  const router = useRouter()
  const parametros = useSearchParams()
  const [ubicando, setUbicando] = useState(false)

  const ir = (cambios: Record<string, string>) => {
    const nuevos = new URLSearchParams(parametros.toString())
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) nuevos.set(clave, valor)
      else nuevos.delete(clave)
    }
    router.push(`/center/rutas?${nuevos}`)
  }

  const ubicarPendientes = async () => {
    setUbicando(true)
    const r = await llamarApi<{ revisados: number, ubicados: number, noEncontrados: number[] }>("/mensajeria/ubicar-pendientes", "POST", { fecha })
    setUbicando(false)
    if (!r.ok) return toast.error(r.error)
    toast.success(`${r.datos.ubicados} de ${r.datos.revisados} dirección(es) ubicada(s)`)
    if (r.datos.noEncontrados.length) toast.warning(`Ubique a mano: ${r.datos.noEncontrados.map(id => `#${id}`).join(", ")}`, { autoClose: 10000 })
    router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center rounded-md border border-slate-200 bg-white">
        <button type="button" onClick={() => ir({ fecha: moverDias(fecha, -1) })} className="h-9 px-2 text-slate-500 hover:text-slate-700" aria-label="Día anterior"><ChevronLeft size={16} /></button>
        <input type="date" value={fecha} onChange={e => e.target.value && ir({ fecha: e.target.value })} className="h-9 border-x border-slate-200 px-2 text-xs text-slate-700 outline-none" aria-label="Día" />
        <button type="button" onClick={() => ir({ fecha: moverDias(fecha, 1) })} className="h-9 px-2 text-slate-500 hover:text-slate-700" aria-label="Día siguiente"><ChevronRight size={16} /></button>
      </div>
      {fecha !== hoy && (
        <button type="button" onClick={() => ir({ fecha: hoy })} className="h-9 px-2 text-xs font-medium text-sky-600 hover:underline">Hoy</button>
      )}

      <SelectBuscable value={parametros.get("sedeId") ?? ""} onChange={e => ir({ sedeId: e.target.value })} className={claseControl} aria-label="Sede">
        <option value="">Todas las sedes</option>
        {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
      </SelectBuscable>

      {sinUbicacion > 0 && googleDisponible && (
        <button type="button" onClick={ubicarPendientes} disabled={ubicando}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50">
          {ubicando ? <Loader2 size={15} className="animate-spin" /> : <LocateFixed size={15} />}
          Ubicar {sinUbicacion} pendiente(s) con Google
        </button>
      )}
    </div>
  )
}
