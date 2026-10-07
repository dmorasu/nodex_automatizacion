"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
import { formatoMoneda } from "@/src/lib/formato"
import { claseBotonPrimario } from "../ui/estilos"
import ModalConfirmarLotes from "./ModalConfirmarLotes"

// Último paso del pago: Tesorería adjunta el soporte del banco (aquí mismo, o el que ya subió)
// y confirma con la fecha real. Ahí se descuenta la bolsa y los gastos quedan Pagados.
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
        {haySoporte
          ? "Ya tiene soporte del banco. Al confirmar se descuenta la bolsa y se avisa por correo a quienes crearon los gastos."
          : "Adjunte el soporte del banco al confirmar (o súbalo arriba). Se descuenta la bolsa y se avisa a quienes crearon los gastos."}
      </p>
      <button type="button" onClick={() => setAbierto(true)} className={claseBotonPrimario}>
        <CheckCircle2 size={15} />
        Confirmar pago de {formatoMoneda(total)}
      </button>

      {abierto && (
        <ModalConfirmarLotes
          lotes={[{ id: loteId, total, cantidadGastos, bolsa }]}
          requiereSoporte={!haySoporte}
          onCerrar={() => setAbierto(false)}
          onConfirmados={() => router.refresh()}
        />
      )}
    </div>
  )
}
