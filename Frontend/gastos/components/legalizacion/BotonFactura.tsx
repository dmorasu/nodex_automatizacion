"use client"

import { useState } from "react"
import { Receipt } from "lucide-react"
import type { Factura } from "@/src/schemas/gastos"
import ModalFactura, { type GastoAFacturar, type Tasas } from "./ModalFactura"

// Botón que abre la ventana para registrar o corregir la factura real de un gasto
export default function BotonFactura({
  gasto,
  factura = null,
  tasas,
  tipoDocumentoFacturaId,
  compacto = false
}: {
  gasto: GastoAFacturar
  factura?: Factura | null
  tasas: Tasas
  tipoDocumentoFacturaId: number | null
  compacto?: boolean
}) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={compacto
          ? "inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
          : "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50"}
      >
        <Receipt size={compacto ? 13 : 15} />
        {factura ? "Corregir factura" : "Registrar factura"}
      </button>

      {abierto && (
        <ModalFactura
          gasto={gasto}
          factura={factura}
          tasas={tasas}
          tipoDocumentoFacturaId={tipoDocumentoFacturaId}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  )
}
