"use client"

import { anularGasto } from "@/actions/gastos/gastos"
import BotonConMotivo from "../ui/BotonConMotivo"

// cajaMenor: gasto ya entregado por caja menor (solo lo anula el Administrador); el efectivo vuelve a la caja
export default function AnularGasto({ gastoId, codigo, cajaMenor = null }: { gastoId: number, codigo: string, cajaMenor?: string | null }) {
  return (
    <BotonConMotivo
      etiqueta="Anular"
      titulo={`Anular gasto ${codigo}`}
      descripcion={cajaMenor
        ? `El gasto queda anulado y lo entregado vuelve al saldo de ${cajaMenor}. Esta acción no se puede deshacer.`
        : "El gasto queda anulado y no podrá pagarse. Esta acción no se puede deshacer."}
      mensajeExito={`Gasto ${codigo} anulado`}
      onConfirmar={motivo => anularGasto(gastoId, motivo)}
    />
  )
}
