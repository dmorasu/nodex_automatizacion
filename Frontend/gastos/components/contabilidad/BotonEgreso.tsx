"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { FileDigit, Loader2 } from "lucide-react"
import { registrarEgreso } from "@/actions/gastos/contabilidad"
import { formatoMoneda } from "@/src/lib/formato"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseLabel } from "../ui/estilos"

// Registra o corrige el número de egreso de un pago (lote)
export default function BotonEgreso({
  loteId,
  total,
  cantidadGastos,
  numeroActual
}: {
  loteId: number
  total: string
  cantidadGastos: number
  numeroActual: string | null
}) {
  const [abierto, setAbierto] = useState(false)
  const [numero, setNumero] = useState(numeroActual ?? "")
  const [guardando, startGuardar] = useTransition()

  const guardar = () => {
    if (!numero.trim()) return toast.error("Indique el número de egreso")

    startGuardar(async () => {
      const resultado = await registrarEgreso(loteId, numero.trim())

      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }

      toast.success(`Egreso ${numero.trim()} registrado en el lote #${loteId}`)
      setAbierto(false)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={numeroActual
          ? "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-100"
          : "inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"}
      >
        <FileDigit size={13} />
        {numeroActual ? "Corregir" : "Registrar egreso"}
      </button>

      <Dialog open={abierto} onClose={() => !guardando && setAbierto(false)} className="relative z-50">
        <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <DialogTitle className="text-sm font-semibold text-slate-800">Número de egreso · lote #{loteId}</DialogTitle>
            <p className="mt-1 text-xs text-slate-400">
              Pago de {formatoMoneda(total)} ({cantidadGastos} gasto(s)). Queda registrado en el lote y en cada gasto.
            </p>

            <label className="mt-4 block">
              <span className={claseLabel}>Número de egreso <span className="text-red-400">*</span></span>
              <input
                value={numero}
                onChange={e => setNumero(e.target.value)}
                onKeyDown={e => e.key === "Enter" && guardar()}
                maxLength={50}
                className={claseInput}
                autoFocus
              />
            </label>

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
