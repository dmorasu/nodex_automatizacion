"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { Loader2, Pencil } from "lucide-react"
import { ajustarRetencionCuenta } from "@/actions/gastos/cuentasTramitadores"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseLabel, claseTextarea } from "@/components/ui/estilos"

// Tesorería cambia la retención que calculó Nodex (basta con el motivo; queda en el historial)
export default function AjustarRetencion({ id, retencion }: { id: number, retencion: number }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [valor, setValor] = useState("")
  const [motivo, setMotivo] = useState("")
  const [guardando, startGuardar] = useTransition()

  const abrir = () => {
    setValor(String(retencion / 100))
    setMotivo("")
    setAbierto(true)
  }

  const guardar = () => {
    if (!(Number(valor) >= 0) || valor === "") return toast.error("Escriba la retención")
    if (!motivo.trim()) return toast.error("Indique el motivo")
    startGuardar(async () => {
      const resultado = await ajustarRetencionCuenta(id, Number(valor), motivo.trim())
      if (!resultado.ok) return resultado.errores.forEach(e => toast.error(e))
      toast.success("Retención ajustada")
      setAbierto(false)
      router.refresh()
    })
  }

  return (
    <>
      <button type="button" onClick={abrir} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-emerald-700" aria-label="Ajustar la retención" title="Ajustar la retención">
        <Pencil size={13} />
      </button>

      <Dialog open={abierto} onClose={() => !guardando && setAbierto(false)} className="relative z-50">
        <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <DialogTitle className="text-sm font-semibold text-slate-800">Ajustar la retención</DialogTitle>
            <label className="mt-4 block">
              <span className={claseLabel}>Retención (pesos)</span>
              <input type="number" min={0} step="1" value={valor} onChange={e => setValor(e.target.value)} className={claseInput} autoFocus />
            </label>
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} maxLength={1000} placeholder="Motivo" className={`${claseTextarea} mt-4`} />
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setAbierto(false)} disabled={guardando} className={claseBotonSecundario}>Cancelar</button>
              <button type="button" onClick={guardar} disabled={guardando} className={claseBotonPrimario}>
                {guardando && <Loader2 size={15} className="animate-spin" />}
                Guardar
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  )
}
