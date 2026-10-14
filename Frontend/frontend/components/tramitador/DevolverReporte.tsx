"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Loader2, Undo2 } from "lucide-react"
import { devolverReporteRealizado } from "@/actions/seguimiento-tramitador-action"

// Devuelve el trámite al tramitador con un motivo obligatorio (le llega un aviso en la app)
export default function DevolverReporte({ reporteId, solicitudTramiteId }: { reporteId: number, solicitudTramiteId: number }) {
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState("")
  const [guardando, startGuardar] = useTransition()

  const devolver = () => {
    if (!motivo.trim()) return toast.error("Escriba el motivo de la devolución")
    startGuardar(async () => {
      const resultado = await devolverReporteRealizado(reporteId, solicitudTramiteId, motivo.trim())
      if (!resultado.ok) return resultado.errores.forEach(error => toast.error(error))
      toast.success("Trámite devuelto. Se avisó al tramitador")
      setAbierto(false)
      setMotivo("")
    })
  }

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-red-200 bg-white text-xs font-semibold text-red-700 hover:bg-red-50">
        <Undo2 size={14} />
        Devolver trámite
      </button>
    )
  }

  return (
    <div className="mt-2 space-y-2">
      <textarea
        value={motivo}
        onChange={e => setMotivo(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder="Motivo de la devolución (lo verá el tramitador)"
        aria-label="Motivo de la devolución"
        className="w-full min-w-56 rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
      />
      <div className="flex gap-2">
        <button type="button" onClick={devolver} disabled={guardando} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-red-600 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
          {guardando ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />}
          Devolver
        </button>
        <button type="button" onClick={() => setAbierto(false)} disabled={guardando} className="h-8 px-3 rounded-md border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">
          Cancelar
        </button>
      </div>
    </div>
  )
}
