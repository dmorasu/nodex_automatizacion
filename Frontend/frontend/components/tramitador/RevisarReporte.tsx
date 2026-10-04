"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { CheckCheck, Loader2 } from "lucide-react"
import { revisarReporteRealizado } from "@/actions/seguimiento-tramitador-action"

// Marca un reporte de "realizado" como revisado, con una nota opcional
export default function RevisarReporte({ reporteId, solicitudTramiteId }: { reporteId: number, solicitudTramiteId: number }) {
  const [abierto, setAbierto] = useState(false)
  const [nota, setNota] = useState("")
  const [guardando, startGuardar] = useTransition()

  const revisar = () =>
    startGuardar(async () => {
      const resultado = await revisarReporteRealizado(reporteId, solicitudTramiteId, nota)
      if (!resultado.ok) return resultado.errores.forEach(error => toast.error(error))
      toast.success("Reporte marcado como revisado. Recuerde actualizar el estado del trámite si corresponde")
      setAbierto(false)
    })

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-amber-300 bg-white text-xs font-semibold text-amber-700 hover:bg-amber-50">
        <CheckCheck size={14} />
        Marcar revisado
      </button>
    )
  }

  return (
    <div className="mt-2 space-y-2">
      <textarea
        value={nota}
        onChange={e => setNota(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="Nota de la revisión (opcional)"
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
      />
      <div className="flex gap-2">
        <button type="button" onClick={revisar} disabled={guardando} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-sky-500 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50">
          {guardando ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
          Confirmar
        </button>
        <button type="button" onClick={() => setAbierto(false)} disabled={guardando} className="h-8 px-3 rounded-md border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">
          Cancelar
        </button>
      </div>
    </div>
  )
}
