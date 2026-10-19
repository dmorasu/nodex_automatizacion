"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
import { formatoMoneda } from "@/src/lib/formato"
import { claseBotonPrimario } from "../ui/estilos"
import ModalConfirmarLotes from "./ModalConfirmarLotes"

// Último paso del pago: Tesorería adjunta el soporte de pago de cada gasto (y, si quiere, el del
// banco para el lote) y confirma con la fecha real. Ahí se descuenta la bolsa y los gastos quedan Pagados.
// Para confirmar varios lotes a la vez: Tesorería → Programados.
export default function ConfirmarPagoLote({ loteId, total, haySoporte, cantidadGastos, bolsa }: {
  loteId: number
  total: string
  haySoporte: boolean
  cantidadGastos: number
  bolsa: { nombre: string }
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-500">
        Al confirmar se adjunta el soporte de pago de cada gasto{haySoporte ? " (el lote ya tiene el del banco)" : ""} y se descuenta la bolsa.
      </p>
      <button type="button" onClick={() => setAbierto(true)} className={claseBotonPrimario}>
        <CheckCircle2 size={15} />
        Confirmar pago de {formatoMoneda(total)}
      </button>

      {abierto && (
        <ModalConfirmarLotes
          lotes={[{ id: loteId, total, cantidadGastos, bolsa }]}
          onCerrar={() => setAbierto(false)}
          onConfirmados={() => router.refresh()}
        />
      )}
    </div>
  )
}
