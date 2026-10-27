"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { Loader2, PencilLine } from "lucide-react"
import { corregirValorPagado } from "@/actions/gastos/gastos"
import { formatoMoneda } from "@/src/lib/formato"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseLabel, claseTextarea } from "@/components/ui/estilos"

// Administrador de Gastos, gasto en Pagado: corrige el valor solicitado y el pagado (ej: se
// confirmó el pago con un cero de menos). La bolsa se ajusta por la diferencia en el backend.
export default function CorregirValorPagado({ gastoId, codigo, bolsa, valorSolicitado, valorPagado }: {
  gastoId: number
  codigo: string
  bolsa: string | null
  valorSolicitado: string
  valorPagado: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [solicitado, setSolicitado] = useState(valorSolicitado)
  const [pagado, setPagado] = useState(valorPagado)
  const [motivo, setMotivo] = useState("")
  const [procesando, startProcesar] = useTransition()

  // Positiva: se pagó más de lo registrado y la bolsa se descuenta; negativa: vuelve dinero
  const diferencia = Math.round(Number(pagado || 0) * 100 - Number(valorPagado) * 100) / 100

  const abrir = () => {
    setSolicitado(valorSolicitado)
    setPagado(valorPagado)
    setMotivo("")
    setAbierto(true)
  }

  const guardar = () => {
    if (!(Number(solicitado) > 0) || !(Number(pagado) > 0)) return toast.error("Los valores deben ser mayores a cero")
    if (!motivo.trim()) return toast.error("Indique el motivo")

    startProcesar(async () => {
      const resultado = await corregirValorPagado(gastoId, {
        valorSolicitado: Number(solicitado),
        valorPagado: Number(pagado),
        motivo: motivo.trim()
      })

      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }

      toast.success(`Valor de ${codigo} corregido`)
      setAbierto(false)
    })
  }

  return (
    <>
      <button type="button" onClick={abrir} className={claseBotonSecundario}>
        <PencilLine size={15} />
        Corregir valor
      </button>

      <Dialog open={abierto} onClose={() => !procesando && setAbierto(false)} className="relative z-50">
        <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <DialogTitle className="text-sm font-semibold text-slate-800">Corregir valor · {codigo}</DialogTitle>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={claseLabel}>Valor solicitado</span>
                <input type="number" min={0} step="0.01" value={solicitado} onChange={e => setSolicitado(e.target.value)} className={claseInput} />
              </label>
              <label className="block">
                <span className={claseLabel}>Valor pagado</span>
                <input type="number" min={0} step="0.01" value={pagado} onChange={e => setPagado(e.target.value)} className={claseInput} />
              </label>
            </div>

            {/* Advertencia de la confirmación: cuánto se mueve la bolsa */}
            {diferencia !== 0 && (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {diferencia > 0
                  ? <>Se descuentan <b>{formatoMoneda(diferencia)}</b> de la bolsa {bolsa}.</>
                  : <>Se devuelven <b>{formatoMoneda(-diferencia)}</b> a la bolsa {bolsa}.</>}
              </p>
            )}

            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Motivo"
              className={`${claseTextarea} mt-4`}
            />

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setAbierto(false)} disabled={procesando} className={claseBotonSecundario}>
                Cancelar
              </button>
              <button type="button" onClick={guardar} disabled={procesando} className={claseBotonPrimario}>
                {procesando && <Loader2 size={15} className="animate-spin" />}
                Guardar
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  )
}
