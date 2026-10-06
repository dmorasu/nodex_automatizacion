"use client"

import { useState, useTransition } from "react"
import { toast } from "react-toastify"
import { CheckCircle2, Loader2 } from "lucide-react"
import { confirmarPago } from "@/actions/gastos/tesoreria"
import { formatoMoneda } from "@/src/lib/formato"
import { claseBotonPrimario, claseInput, claseLabel, claseTextarea } from "../ui/estilos"

const hoyEnBogota = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })

// Último paso del pago: con el soporte del banco ya adjunto, Tesorería confirma.
// Ahí se descuenta la bolsa y los gastos quedan Pagados.
export default function ConfirmarPagoLote({ loteId, total, haySoporte }: {
  loteId: number
  total: string
  haySoporte: boolean
}) {
  const [fechaPago, setFechaPago] = useState(hoyEnBogota)
  const [observacion, setObservacion] = useState("")
  const [confirmando, start] = useTransition()

  const confirmar = () => {
    if (!fechaPago) return toast.error("Indique la fecha del pago")
    start(async () => {
      const resultado = await confirmarPago(loteId, fechaPago, observacion)
      if (!resultado.ok) {
        resultado.errores.forEach(error => toast.error(error))
        return
      }
      toast.success(`Pago del lote #${loteId} confirmado. Se avisó a quienes crearon los gastos.`)
    })
  }

  return (
    <div className="space-y-4">
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`text-xs ${haySoporte ? "text-slate-500" : "text-amber-700"}`}>
          {haySoporte
            ? "Al confirmar se descuenta la bolsa y se avisa por correo a quienes crearon los gastos."
            : "Adjunte arriba el soporte del banco para poder confirmar el pago."}
        </p>
        <button type="button" onClick={confirmar} disabled={confirmando || !haySoporte} className={claseBotonPrimario}>
          {confirmando ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
          Confirmar pago de {formatoMoneda(total)}
        </button>
      </div>
    </div>
  )
}
