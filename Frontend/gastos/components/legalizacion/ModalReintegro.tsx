"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { Loader2 } from "lucide-react"
import { marcarReintegrado } from "@/actions/gastos/legalizacion"
import { formatoMoneda } from "@/src/lib/formato"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseLabel } from "../ui/estilos"

const hoyEnBogota = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })

// Marca como recibido un reintegro pendiente: el valor vuelve a la bolsa del gasto
export default function ModalReintegro({
  reintegroId,
  codigo,
  valor,
  onCerrar
}: {
  reintegroId: number
  codigo: string
  valor: string
  onCerrar: () => void
}) {
  const [fecha, setFecha] = useState(hoyEnBogota)
  const [archivos, setArchivos] = useState<File[]>([])
  const [guardando, startGuardar] = useTransition()

  const guardar = () => {
    if (!fecha) return toast.error("Indique la fecha en que se recibió")

    let soporte: FormData | null = null
    if (archivos.length > 0) {
      soporte = new FormData()
      archivos.forEach(archivo => soporte!.append("archivos", archivo))
    }

    startGuardar(async () => {
      const resultado = await marcarReintegrado(reintegroId, fecha, soporte)

      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }

      toast.success(`Reintegro de ${formatoMoneda(valor)} devuelto a la bolsa`)
      if (resultado.advertencia) toast.warning(resultado.advertencia, { autoClose: false })
      onCerrar()
    })
  }

  return (
    <Dialog open onClose={() => !guardando && onCerrar()} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <DialogTitle className="text-sm font-semibold text-slate-800">Marcar como reintegrado · {codigo}</DialogTitle>
          <p className="mt-1 text-xs text-slate-400">
            Valor: <b className="text-slate-600">{formatoMoneda(valor)}</b>. Al confirmar, vuelve a la bolsa del gasto.
          </p>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className={claseLabel}>Fecha en que se recibió <span className="text-red-400">*</span></span>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={claseInput} />
            </label>
            <label className="block">
              <span className={claseLabel}>Soporte de la devolución</span>
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => setArchivos(Array.from(e.target.files ?? []))}
                className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-600 hover:file:bg-slate-200"
              />
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onCerrar} disabled={guardando} className={claseBotonSecundario}>Cancelar</button>
            <button type="button" onClick={guardar} disabled={guardando} className={claseBotonPrimario}>
              {guardando && <Loader2 size={15} className="animate-spin" />}
              Confirmar
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
