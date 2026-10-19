"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { CalendarClock, Loader2, Save } from "lucide-react"
import { guardarHoraCorte } from "@/actions/gastos/catalogos"
import { claseBotonPrimario, claseInput, claseLabel } from "../ui/estilos"

// Hora de corte de la programación de pagos: los gastos creados en un día hábil antes de esta
// hora se programan ese mismo día; los demás, el siguiente día hábil (y se le avisa a quien lo crea)
export default function HoraCorteProgramacion({ hora }: { hora: string }) {
  const [valor, setValor] = useState(hora)
  const [guardando, startGuardar] = useTransition()

  const guardar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\d{2}:\d{2}$/.test(valor)) return toast.error("Escriba una hora válida")
    startGuardar(async () => {
      const resultado = await guardarHoraCorte(valor)
      if (!resultado.ok) return resultado.errores.forEach(error => toast.error(error))
      toast.success("Hora de corte guardada")
    })
  }

  return (
    <form onSubmit={guardar} className="max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <CalendarClock size={18} />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-800">Hora de corte para programar pagos</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Los gastos creados en un día hábil antes de esta hora se programan ese mismo día; los creados después, el siguiente día hábil.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="block w-40">
          <span className={claseLabel}>Hora (Colombia)</span>
          <input type="time" value={valor} onChange={e => setValor(e.target.value)} required className={claseInput} />
        </label>
        <button type="submit" disabled={guardando || valor === hora} className={claseBotonPrimario}>
          {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Guardar
        </button>
      </div>
    </form>
  )
}
