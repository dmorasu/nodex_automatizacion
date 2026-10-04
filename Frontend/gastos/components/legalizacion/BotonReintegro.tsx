"use client"

import { useState } from "react"
import { CheckCircle2 } from "lucide-react"
import ModalReintegro from "./ModalReintegro"

// Abre la ventana para marcar como recibido un reintegro pendiente
export function BotonMarcarReintegrado({ reintegroId, codigo, valor }: { reintegroId: number, codigo: string, valor: string }) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
      >
        <CheckCircle2 size={13} />
        Marcar reintegrado
      </button>
      {abierto && <ModalReintegro reintegroId={reintegroId} codigo={codigo} valor={valor} onCerrar={() => setAbierto(false)} />}
    </>
  )
}
