"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { CheckCircle2, Loader2, Paperclip } from "lucide-react"
import { confirmarLotes } from "@/actions/gastos/tesoreria"
import { formatoMoneda } from "@/src/lib/formato"
import { claseBotonPrimario, claseBotonSecundario, claseInput, claseLabel, claseTextarea } from "../ui/estilos"

const hoyEnBogota = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })

export type LoteAConfirmar = { id: number, total: string, cantidadGastos: number, bolsa: { nombre: string } }

// Último paso del pago, para uno o varios lotes aprobados por Dirección de Negocio: se adjunta
// el soporte del banco (sirve uno para todos), la fecha real y se confirma. Ahí se descuentan las
// bolsas, los gastos quedan Pagados y se avisa a quienes los crearon.
// `requiereSoporte` = false cuando el lote ya tiene su soporte adjunto (detalle del lote).
export default function ModalConfirmarLotes({
  lotes,
  requiereSoporte = true,
  onCerrar,
  onConfirmados
}: {
  lotes: LoteAConfirmar[]
  requiereSoporte?: boolean
  onCerrar: () => void
  onConfirmados?: () => void
}) {
  const [archivos, setArchivos] = useState<File[]>([])
  const [fechaPago, setFechaPago] = useState(hoyEnBogota)
  const [observacion, setObservacion] = useState("")
  const [confirmando, start] = useTransition()

  const total = lotes.reduce((t, l) => t + Math.round(Number(l.total) * 100), 0) / 100
  const gastos = lotes.reduce((t, l) => t + l.cantidadGastos, 0)
  const uno = lotes.length === 1

  const confirmar = () => {
    if (requiereSoporte && archivos.length === 0) return toast.error("Adjunte el soporte del banco")
    if (!fechaPago) return toast.error("Indique la fecha del pago")

    const formData = new FormData()
    formData.append("datos", JSON.stringify({ loteIds: lotes.map(l => l.id), fechaPago, observacion: observacion.trim() || null }))
    archivos.forEach(archivo => formData.append("archivos", archivo))

    start(async () => {
      const resultado = await confirmarLotes(formData)
      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }
      toast.success(`${uno ? `Pago del lote #${lotes[0].id} confirmado` : `${lotes.length} lotes confirmados`} (${resultado.datos.gastos} gasto(s)). Se avisó a quienes los crearon.`)
      onConfirmados?.()
      onCerrar()
    })
  }

  return (
    <Dialog open onClose={() => !confirmando && onCerrar()} className="relative z-50">
      <div className="fixed inset-0 bg-slate-900/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
          <DialogTitle className="text-sm font-semibold text-slate-800">
            {uno ? `Confirmar pago del lote #${lotes[0].id}` : `Confirmar pago de ${lotes.length} lotes`}
          </DialogTitle>
          <p className="mt-1 text-xs text-slate-400">
            {gastos} gasto(s) por {formatoMoneda(total)}. Adjunte el soporte del banco
            {uno ? "" : " (uno solo sirve para todos: se guarda en cada lote)"} y la fecha en que se pagó.
          </p>

          {!uno && (
            <ul className="mt-3 max-h-32 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200 text-xs">
              {lotes.map(l => (
                <li key={l.id} className="flex justify-between gap-3 px-3 py-2">
                  <span className="text-slate-600">Lote #{l.id} · {l.bolsa.nombre} · {l.cantidadGastos} gasto(s)</span>
                  <b className="text-slate-800">{formatoMoneda(l.total)}</b>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 space-y-4">
            <div>
              <span className={claseLabel}>
                Soporte del banco {requiereSoporte ? <span className="text-red-400">*</span> : <span className="text-slate-400">(el lote ya tiene; puede agregar otro)</span>}
              </span>
              <label className={`${claseBotonSecundario} cursor-pointer`}>
                <Paperclip size={15} />
                Seleccionar archivos
                <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={e => setArchivos(Array.from(e.target.files ?? []))} />
              </label>
              {archivos.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
                  {archivos.map(a => <li key={a.name}>· {a.name}</li>)}
                </ul>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={claseLabel}>Fecha del pago en el banco <span className="text-red-400">*</span></span>
                <input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} className={claseInput} />
              </label>
              <label className="block">
                <span className={claseLabel}>Observación</span>
                <textarea value={observacion} onChange={e => setObservacion(e.target.value)} rows={1} maxLength={1000} className={claseTextarea} />
              </label>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onCerrar} disabled={confirmando} className={claseBotonSecundario}>Cancelar</button>
            <button type="button" onClick={confirmar} disabled={confirmando} className={claseBotonPrimario}>
              {confirmando ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Confirmar pago de {formatoMoneda(total)}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
