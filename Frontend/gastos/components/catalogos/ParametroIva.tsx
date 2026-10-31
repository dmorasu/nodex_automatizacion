"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Loader2, Percent, Save } from "lucide-react"
import { guardarTarifaIva } from "@/actions/gastos/catalogos"
import { claseBotonPrimario, claseInput, claseLabel } from "../ui/estilos"

// Tarifa del IVA que se suma a la base (el valor consignado) de las solicitudes de factura.
// Las solicitudes ya registradas conservan la tarifa con que se registraron
export default function ParametroIva({ tarifa }: { tarifa: number }) {
  const [valor, setValor] = useState(String(tarifa))
  const [guardando, startGuardar] = useTransition()

  const guardar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!(Number(valor) >= 0 && Number(valor) <= 100) || valor === "") return toast.error("La tarifa debe estar entre 0 y 100 %")
    startGuardar(async () => {
      const resultado = await guardarTarifaIva(Number(valor))
      if (!resultado.ok) return resultado.errores.forEach(error => toast.error(error))
      toast.success("Tarifa del IVA guardada")
    })
  }

  return (
    <form onSubmit={guardar} className="max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <Percent size={18} />
        </span>
        <p className="text-sm font-semibold text-slate-800">IVA de las solicitudes de factura</p>
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="block w-40">
          <span className={claseLabel}>Tarifa (%)</span>
          <input type="number" min={0} max={100} step="0.01" value={valor} onChange={e => setValor(e.target.value)} required className={claseInput} />
        </label>
        <button type="submit" disabled={guardando || Number(valor) === tarifa} className={claseBotonPrimario}>
          {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Guardar
        </button>
      </div>
    </form>
  )
}
