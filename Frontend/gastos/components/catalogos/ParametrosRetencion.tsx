"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Loader2, Percent, Save } from "lucide-react"
import { guardarParametrosRetencion } from "@/actions/gastos/catalogos"
import { claseBotonPrimario, claseInput, claseLabel } from "../ui/estilos"

// Valores con que Nodex calcula la retención de las cuentas de cobro de los tramitadores: la UVT
// (tabla del art. 383, se actualiza cada enero) y la tarifa de quien no firmó la declaración
export default function ParametrosRetencion({ uvt, tarifa }: { uvt: number, tarifa: number }) {
  const [valorUvt, setValorUvt] = useState(String(uvt))
  const [valorTarifa, setValorTarifa] = useState(String(tarifa))
  const [guardando, startGuardar] = useTransition()
  const sinCambios = Number(valorUvt) === uvt && Number(valorTarifa) === tarifa

  const guardar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!(Number(valorUvt) > 0)) return toast.error("Escriba el valor de la UVT")
    if (!(Number(valorTarifa) >= 0 && Number(valorTarifa) <= 100)) return toast.error("La tarifa debe estar entre 0 y 100 %")
    startGuardar(async () => {
      const resultado = await guardarParametrosRetencion(Number(valorUvt), Number(valorTarifa))
      if (!resultado.ok) return resultado.errores.forEach(error => toast.error(error))
      toast.success("Valores de la retención guardados")
    })
  }

  return (
    <form onSubmit={guardar} className="max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <Percent size={18} />
        </span>
        <p className="text-sm font-semibold text-slate-800">Retención de las cuentas de cobro de tramitadores</p>
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="block w-40">
          <span className={claseLabel}>UVT del año (pesos)</span>
          <input type="number" min={1} step="1" value={valorUvt} onChange={e => setValorUvt(e.target.value)} required className={claseInput} />
        </label>
        <label className="block w-48">
          <span className={claseLabel}>Tarifa sin declaración art. 383 (%)</span>
          <input type="number" min={0} max={100} step="0.01" value={valorTarifa} onChange={e => setValorTarifa(e.target.value)} required className={claseInput} />
        </label>
        <button type="submit" disabled={guardando || sinCambios} className={claseBotonPrimario}>
          {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Guardar
        </button>
      </div>
    </form>
  )
}
