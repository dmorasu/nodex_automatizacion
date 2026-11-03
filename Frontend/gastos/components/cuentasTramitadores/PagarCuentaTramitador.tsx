"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"
import { CircleDollarSign, Loader2 } from "lucide-react"
import { pagarCuentaTramitador } from "@/actions/gastos/cuentasTramitadores"
import { formatoMoneda } from "@/src/lib/formato"
import { claseBotonPrimario, claseInput, claseLabel } from "@/components/ui/estilos"

// Marcar pagada la cuenta de cobro del tramitador: el neto sale de la bolsa de no reembolsables
// que se elija (si hay una sola, ya viene elegida), con fecha, observación y soporte opcional
export default function PagarCuentaTramitador({ id, hoy, neto, bolsas }: {
  id: number
  hoy: string
  // Neto a pagar en centavos (total − retención)
  neto: number
  bolsas: { id: number, nombre: string }[]
}) {
  const router = useRouter()
  const [bolsaId, setBolsaId] = useState(bolsas.length === 1 ? String(bolsas[0].id) : "")
  const [fecha, setFecha] = useState(hoy)
  const [observacion, setObservacion] = useState("")
  const [soporte, setSoporte] = useState<File | null>(null)
  const [enviando, startEnviar] = useTransition()

  const pagar = () => {
    if (!bolsaId) return toast.error("Elija la bolsa")
    if (!fecha) return toast.error("Indique la fecha de pago")
    const bolsa = bolsas.find(b => String(b.id) === bolsaId)?.nombre
    if (!confirm(`¿Marcar la cuenta como pagada? Se registran ${formatoMoneda(neto / 100)} en la bolsa ${bolsa} y se avisa al tramitador.`)) return
    const datos = new FormData()
    datos.append("bolsaId", bolsaId)
    datos.append("fechaPago", fecha)
    if (observacion.trim()) datos.append("observacion", observacion.trim())
    if (soporte) datos.append("soporte", soporte)
    startEnviar(async () => {
      const resultado = await pagarCuentaTramitador(id, datos)
      if (!resultado.ok) return resultado.errores.forEach(e => toast.error(e))
      toast.success("Cuenta marcada como pagada")
      router.refresh()
    })
  }

  return (
    <div className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_10rem_1fr_1fr_auto] lg:items-end">
      <label className="block">
        <span className={claseLabel}>Bolsa</span>
        <select value={bolsaId} onChange={e => setBolsaId(e.target.value)} className={claseInput}>
          {bolsas.length !== 1 && <option value="">{bolsas.length ? "Elija la bolsa" : "No hay bolsas de no reembolsables"}</option>}
          {bolsas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
        </select>
      </label>
      <label className="block">
        <span className={claseLabel}>Fecha de pago</span>
        <input type="date" value={fecha} max={hoy} onChange={e => setFecha(e.target.value)} className={claseInput} />
      </label>
      <label className="block">
        <span className={claseLabel}>Observación</span>
        <input value={observacion} onChange={e => setObservacion(e.target.value)} maxLength={1000} className={claseInput} />
      </label>
      <label className="block">
        <span className={claseLabel}>Soporte de pago</span>
        <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={e => setSoporte(e.target.files?.[0] ?? null)}
          className="block w-full text-xs text-slate-600 file:mr-3 file:h-10 file:rounded-md file:border-0 file:bg-white file:px-3 file:text-xs file:font-semibold file:text-slate-600" />
      </label>
      <button type="button" onClick={pagar} disabled={enviando} className={claseBotonPrimario}>
        {enviando ? <Loader2 size={15} className="animate-spin" /> : <CircleDollarSign size={15} />}
        Marcar pagada
      </button>
    </div>
  )
}
